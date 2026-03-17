import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { getShopifyToken } from "@/lib/shopify-token";

// Profit Data Sync — pulls Shopify orders + Meta ad spend, computes daily P&L
// Writes daily rows to profit_logs table (all values in USD)

const META_API = "https://graph.facebook.com/v19.0";

// Fallback timezone map — only used if Shopify store timezone can't be fetched
const MARKET_TIMEZONE: Record<string, string> = {
  AU: "Australia/Perth",
  UK: "Europe/London",
  US: "America/New_York",
};

type DailyBucket = {
  revenue: number;
  orders: number;
  returns: number;
  adSpend: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, storeId, daysBack, adAccountIds } = body as {
      userId: string;
      storeId: string;
      daysBack?: number;
      adAccountIds?: string[];
    };

    console.log("[profit-sync API] adAccountIds received:", adAccountIds);

    if (!userId || !storeId) {
      return NextResponse.json(
        { error: "userId and storeId are required" },
        { status: 400 }
      );
    }

    const authResult = await verifyApiUser(request, storeId);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const verifiedUserId = authResult.userId;

    const days = daysBack || 30;

    // ── 0. Get store info (need timezone before processing orders) ──

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("exchange_rate_to_usd, currency, market")
      .eq("id", storeId)
      .single();

    const storeCurrency = store?.currency || "USD";
    const fallbackRate = store?.exchange_rate_to_usd || 1.0;
    // Will be set from Shopify store timezone if available, else fallback
    let storeTimezone = MARKET_TIMEZONE[store?.market ?? ""] || "UTC";

    // Helper: extract YYYY-MM-DD in the store's local timezone from any ISO timestamp
    const toLocalDate = (isoTimestamp: string): string => {
      const d = new Date(isoTimestamp);
      // en-CA locale returns YYYY-MM-DD format
      return d.toLocaleDateString("en-CA", { timeZone: storeTimezone });
    };

    // Compute date range in the store's local timezone
    const now = new Date();
    let endStr = toLocalDate(now.toISOString());
    const startMs = now.getTime() - days * 86_400_000;
    let startStr = toLocalDate(new Date(startMs).toISOString());

    // Initialize daily buckets using store-local dates
    const dailyData = new Map<string, DailyBucket>();
    {
      const d = new Date(startMs);
      // Iterate with some padding to cover timezone edges
      const endMs = now.getTime() + 86_400_000;
      while (d.getTime() <= endMs) {
        const localDate = toLocalDate(d.toISOString());
        if (!dailyData.has(localDate)) {
          dailyData.set(localDate, { revenue: 0, orders: 0, returns: 0, adSpend: 0 });
        }
        d.setTime(d.getTime() + 86_400_000);
      }
    }

    // ── 1. Pull Shopify orders ──────────────────────────────

    const shopify = await getShopifyToken(verifiedUserId, storeId);

    if (shopify) {
      try {
        // ── 1a. Fetch the Shopify store's actual IANA timezone ──
        // This ensures dates match Shopify's own reports exactly.
        const shopRes = await fetch(
          `https://${shopify.shopifyDomain}/admin/api/2024-01/shop.json`,
          { headers: { "X-Shopify-Access-Token": shopify.accessToken } }
        );
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          if (shopData.shop?.iana_timezone) {
            storeTimezone = shopData.shop.iana_timezone;
            // Re-initialize buckets and date range with the correct timezone
            dailyData.clear();
            endStr = toLocalDate(now.toISOString());
            startStr = toLocalDate(new Date(startMs).toISOString());
            const d = new Date(startMs);
            const endMs = now.getTime() + 86_400_000;
            while (d.getTime() <= endMs) {
              const localDate = toLocalDate(d.toISOString());
              if (!dailyData.has(localDate)) {
                dailyData.set(localDate, { revenue: 0, orders: 0, returns: 0, adSpend: 0 });
              }
              d.setTime(d.getTime() + 86_400_000);
            }
          }
        }

        // ── 1b. Fetch orders — pad query window ±1 day for timezone safety ──
        const fetchStartMs = new Date(startStr + "T00:00:00Z").getTime() - 86_400_000;
        const fetchEndMs   = new Date(endStr   + "T23:59:59Z").getTime() + 86_400_000;
        const fetchMin = new Date(fetchStartMs).toISOString();
        const fetchMax = new Date(fetchEndMs).toISOString();

        let pageUrl: string | null =
          `https://${shopify.shopifyDomain}/admin/api/2024-01/orders.json` +
          `?status=any&created_at_min=${fetchMin}&created_at_max=${fetchMax}&limit=250`;

        while (pageUrl) {
          const ordersRes: Response = await fetch(pageUrl, {
            headers: {
              "X-Shopify-Access-Token": shopify.accessToken,
              "Content-Type": "application/json",
            },
          });

          if (!ordersRes.ok) break;

          const ordersData = await ordersRes.json();
          const orders = ordersData.orders || [];

          for (const order of orders) {
            if (!order.created_at) continue;
            const date = toLocalDate(order.created_at);
            if (!dailyData.has(date)) continue;

            const bucket = dailyData.get(date)!;
            // Gross revenue — do NOT subtract refunds here.
            // Shopify reports attribute returns to the refund processing
            // date, not the original order date.
            bucket.revenue += parseFloat(order.total_price || "0");
            bucket.orders += 1;

            // Attribute refund line-item subtotals to the DATE the refund
            // was processed (matches Shopify's "total_sales" report).
            if (order.refunds && Array.isArray(order.refunds)) {
              for (const refund of order.refunds) {
                if (!refund.created_at) continue;
                const refundDate = toLocalDate(refund.created_at);
                if (!dailyData.has(refundDate)) continue;

                const refundBucket = dailyData.get(refundDate)!;
                if (refund.refund_line_items && Array.isArray(refund.refund_line_items)) {
                  for (const rli of refund.refund_line_items) {
                    refundBucket.returns += parseFloat(rli.subtotal || "0");
                  }
                }
              }
            }
          }

          // Check for next page via Link header
          const linkHeader = ordersRes.headers.get("link") || "";
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          pageUrl = nextMatch ? nextMatch[1] : null;
        }
      } catch (err) {
        console.error("Shopify orders fetch error:", err);
      }
    }

    // ── 2. Pull Meta ad spend (from selected ad accounts) ─────

    const { data: metaToken } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, meta")
      .eq("user_id", verifiedUserId)
      .eq("service", "facebook")
      .single();

    if (metaToken?.access_token) {
      // Use explicitly passed account IDs (from user's UI selection), or fall back to all active
      let accountIds: string[] = adAccountIds && adAccountIds.length > 0
        ? adAccountIds
        : [];

      if (accountIds.length === 0) {
        const { data: adAccounts } = await supabaseAdmin
          .from("user_ad_accounts")
          .select("ad_account_id")
          .eq("user_id", verifiedUserId)
          .eq("store_id", storeId)
          .eq("active", true);

        accountIds = (adAccounts || []).map((a) => a.ad_account_id);
      }

      // Fallback to legacy oauth_tokens.meta if still empty
      if (accountIds.length === 0) {
        const metaData = (metaToken.meta as Record<string, string>) || {};
        if (metaData.ad_account_id) {
          accountIds = [metaData.ad_account_id];
        }
      }

      console.log("[profit-sync API] final accountIds:", accountIds);

      // Fetch spend from each active ad account
      for (const adAccountId of accountIds) {
        try {
          const insightsUrl =
            `${META_API}/${adAccountId}/insights` +
            `?fields=spend,actions,action_values` +
            `&time_range={"since":"${startStr}","until":"${endStr}"}` +
            `&time_increment=1` + // Daily breakdown
            `&limit=500`;

          const insightsRes = await fetch(insightsUrl, {
            headers: { Authorization: `Bearer ${metaToken.access_token}` },
          });

          if (insightsRes.ok) {
            const insightsData = await insightsRes.json();
            const insights = insightsData.data || [];

            for (const insight of insights) {
              const date = insight.date_start;
              if (!date || !dailyData.has(date)) continue;

              const bucket = dailyData.get(date)!;
              bucket.adSpend += parseFloat(insight.spend || "0");
            }
          }
        } catch (err) {
          console.error(`Meta insights fetch error for ${adAccountId}:`, err);
        }
      }
    }

    // ── 3. Get COGs for this store ──────────────────────────

    const { data: cogRows } = await supabaseAdmin
      .from("product_cogs")
      .select("product_name, cog_usd")
      .eq("store_id", storeId);

    // Average COG per order (simple approach until per-order COG is implemented)
    let avgCogPerOrder = 0;
    if (cogRows && cogRows.length > 0) {
      const totalCog = cogRows.reduce((sum, r) => sum + (r.cog_usd || 0), 0);
      avgCogPerOrder = totalCog / cogRows.length;
    }

    // ── 4. Fetch historical exchange rates ──────────────────

    // Use Frankfurter API (free, ECB data) for accurate daily rates.
    // Returns a map of date → rate (store currency to USD).
    const dailyRates = new Map<string, number>();
    if (storeCurrency !== "USD") {
      try {
        const rateUrl =
          `https://api.frankfurter.app/${startStr}..${endStr}?from=${storeCurrency}&to=USD`;
        const rateRes = await fetch(rateUrl);
        if (rateRes.ok) {
          const rateData = await rateRes.json();
          const rates = rateData.rates || {};
          for (const [date, currencies] of Object.entries(rates)) {
            const usdRate = (currencies as Record<string, number>).USD;
            if (usdRate) dailyRates.set(date, usdRate);
          }
        }
      } catch (err) {
        console.error("Exchange rate fetch error:", err);
      }
    }

    // Helper: get the exchange rate for a given date, falling back to nearest
    // available rate (weekends/holidays have no ECB data), then store default.
    const getRateForDate = (date: string): number => {
      if (storeCurrency === "USD") return 1.0;
      if (dailyRates.has(date)) return dailyRates.get(date)!;
      // Fall back to the closest preceding date with a rate
      const sorted = Array.from(dailyRates.keys()).sort();
      let closest = fallbackRate;
      for (const d of sorted) {
        if (d <= date) closest = dailyRates.get(d)!;
        else break;
      }
      return closest;
    };

    // ── 5. Compute daily P&L and upsert ─────────────────────

    // Fetch existing COG values so syncs never overwrite user-entered COG
    const { data: existingLogs } = await supabaseAdmin
      .from("profit_logs")
      .select("date, cog_usd")
      .eq("store_id", storeId)
      .gte("date", startStr)
      .lte("date", endStr);

    const existingCogMap = new Map<string, number>();
    if (existingLogs) {
      for (const log of existingLogs) {
        existingCogMap.set(log.date, log.cog_usd);
      }
    }

    const rows = [];
    for (const [date, bucket] of Array.from(dailyData.entries())) {
      // Skip days with no data
      if (bucket.revenue === 0 && bucket.adSpend === 0 && bucket.orders === 0
          && bucket.returns === 0) continue;

      // Net revenue = gross sales - returns (refund line items processed on this date)
      // This matches Shopify's "total_sales" report definition.
      const netRevenue = bucket.revenue - bucket.returns;
      // Revenue comes in store currency, convert to USD using that day's rate
      const revenueUsd = netRevenue * getRateForDate(date);
      // Ad spend is already in USD (Meta reports in account currency, usually USD)
      const adSpendUsd = bucket.adSpend;
      // Preserve user-entered COG for existing rows; only estimate for new rows
      const cogUsd = existingCogMap.has(date)
        ? existingCogMap.get(date)!
        : bucket.orders * avgCogPerOrder;
      // Transaction fee: 2.9% + $0.30 per order
      const transactionFeeUsd = revenueUsd * 0.029 + bucket.orders * 0.3;
      // Profit
      const profitUsd = revenueUsd - cogUsd - adSpendUsd - transactionFeeUsd;
      // ROAS
      const roas = adSpendUsd > 0 ? parseFloat((revenueUsd / adSpendUsd).toFixed(2)) : 0;
      // Profit % — always compute when there's any cost, even if revenue is 0
      const profitPercent = revenueUsd !== 0
        ? parseFloat(((profitUsd / revenueUsd) * 100).toFixed(1))
        : profitUsd < 0 ? -100.0 : 0;

      rows.push({
        store_id: storeId,
        date,
        revenue_usd: Math.round(revenueUsd * 100) / 100,
        cog_usd: Math.round(cogUsd * 100) / 100,
        ad_spend_usd: Math.round(adSpendUsd * 100) / 100,
        transaction_fee_usd: Math.round(transactionFeeUsd * 100) / 100,
        profit_usd: Math.round(profitUsd * 100) / 100,
        roas,
        profit_percent: profitPercent,
        orders: bucket.orders,
        synced_from: "manual",
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: "No data found for the sync period. Connect Shopify and/or Meta first.",
      });
    }

    // Upsert (unique on store_id + date)
    const { error: upsertError } = await supabaseAdmin
      .from("profit_logs")
      .upsert(rows, { onConflict: "store_id,date" });

    if (upsertError) {
      console.error("Failed to upsert profit logs:", upsertError.message);
      return NextResponse.json(
        { error: "Failed to save profit data", details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      synced: rows.length,
      dateRange: { start: startStr, end: endStr },
      message: `Synced ${rows.length} days of profit data`,
    });
  } catch (err) {
    console.error("Profit sync error:", err);
    return NextResponse.json(
      { error: "Internal server error during profit sync" },
      { status: 500 }
    );
  }
}
