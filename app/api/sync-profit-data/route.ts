import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { getShopifyToken } from "@/lib/shopify-token";
import { apiError } from "@/lib/api-error";

// Allow up to 60s on Vercel (Hobby max). Without this, the default is ~10s
// and first-sync (1095 days) gets killed before it finishes.
export const maxDuration = 60;

// Profit Data Sync — pulls Shopify orders + Meta ad spend, computes daily P&L
// All values stored in the STORE'S CURRENCY (e.g. AUD, GBP).
// Column names still say "_usd" (legacy) but values are in store currency.

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
  adSpend: number; // Meta ad spend in USD — converted to store currency before storing
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, daysBack, adAccountIds } = body as {
      storeId: string;
      daysBack?: number;
      adAccountIds?: string[];
    };

    console.log("[profit-sync API] adAccountIds received:", adAccountIds);

    if (!storeId) {
      return apiError("missing_field", "storeId is required", 400);
    }

    const authResult = await verifyApiUser(request, storeId);
    if ("error" in authResult) {
      return apiError("auth_failed", authResult.error, authResult.status);
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
            // Revenue in store currency (AUD/GBP) — stored as-is, no conversion.
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
              // Ad spend is in USD from Meta — stored as USD for now,
              // converted to store currency below using monthly average.
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
      .select("product_id, product_name, cog_usd")
      .eq("store_id", storeId);

    // Average COG per order (simple approach until per-order COG is implemented)
    let avgCogPerOrder = 0;
    if (cogRows && cogRows.length > 0) {
      const totalCog = cogRows.reduce((sum, r) => sum + (r.cog_usd || 0), 0);
      avgCogPerOrder = totalCog / cogRows.length;
    }

    // ── 4. Fetch monthly average exchange rates (USD → store currency) ──
    // Only needed to convert Meta ad spend (USD) into store currency.
    // Uses monthly averages — close enough and avoids daily rate complexity.

    const monthlyUsdToLocal = new Map<string, number>(); // "YYYY-MM" → rate
    if (storeCurrency !== "USD") {
      try {
        // Collect unique months from the data
        const months = new Set<string>();
        for (const [date] of Array.from(dailyData.entries())) {
          months.add(date.slice(0, 7)); // "YYYY-MM"
        }

        // Fetch one rate per month (use 1st of each month)
        await Promise.all(
          Array.from(months).map(async (ym) => {
            // Use the first and last day of the month to get an average
            const [y, m] = ym.split("-").map(Number);
            const lastDay = new Date(y, m, 0).getDate(); // last day of month
            const from = `${ym}-01`;
            const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
            try {
              const res = await fetch(
                `https://api.frankfurter.app/${from}..${to}?from=USD&to=${storeCurrency}`
              );
              if (res.ok) {
                const data = await res.json();
                const rates = data.rates || {};
                const values = Object.values(rates).map(
                  (r) => (r as Record<string, number>)[storeCurrency]
                ).filter(Boolean);
                if (values.length > 0) {
                  const avg = values.reduce((a, b) => a + b, 0) / values.length;
                  monthlyUsdToLocal.set(ym, avg);
                }
              }
            } catch { /* skip month */ }
          })
        );
      } catch (err) {
        console.error("Monthly exchange rate fetch error:", err);
      }
    }

    // Helper: convert USD to store currency using monthly average
    const usdToStoreCurrency = (usdAmount: number, date: string): number => {
      if (storeCurrency === "USD") return usdAmount;
      const ym = date.slice(0, 7);
      const rate = monthlyUsdToLocal.get(ym);
      if (rate) return usdAmount * rate;
      // Fallback: use inverse of store's static rate
      return fallbackRate > 0 ? usdAmount / fallbackRate : usdAmount;
    };

    // ── 5. Compute daily P&L and upsert ─────────────────────
    // ALL values stored in store currency (AUD/GBP/USD).

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

      // Net revenue in store currency — exactly what Shopify reports show.
      const netRevenue = bucket.revenue - bucket.returns;

      // Keep ad spend in USD (as received from Meta)
      const adSpendLocal = bucket.adSpend;

      // COG: preserve user-entered value, or estimate from avg
      const cogLocal = existingCogMap.has(date)
        ? existingCogMap.get(date)!
        : usdToStoreCurrency(bucket.orders * avgCogPerOrder, date);

      // Transaction fee: 2.9% + $0.30 per order (converted to store currency)
      const feePerOrder = usdToStoreCurrency(0.3, date);
      const transactionFeeLocal = netRevenue * 0.029 + bucket.orders * feePerOrder;

      // Profit in store currency
      const profit = netRevenue - cogLocal - adSpendLocal - transactionFeeLocal;

      // ROAS (revenue / ad spend, both in store currency)
      const roas = adSpendLocal > 0 ? parseFloat((netRevenue / adSpendLocal).toFixed(2)) : 0;

      // Profit %
      const profitPercent = netRevenue !== 0
        ? parseFloat(((profit / netRevenue) * 100).toFixed(1))
        : profit < 0 ? -100.0 : 0;

      rows.push({
        store_id: storeId,
        date,
        revenue_usd: Math.round(netRevenue * 100) / 100,
        refunds_usd: Math.round(bucket.returns * 100) / 100,
        cog_usd: Math.round(cogLocal * 100) / 100,
        ad_spend_usd: Math.round(adSpendLocal * 100) / 100,
        transaction_fee_usd: Math.round(transactionFeeLocal * 100) / 100,
        profit_usd: Math.round(profit * 100) / 100,
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
      return apiError("save_profit_data_failed", "Failed to save profit data", 500, true);
    }

    return NextResponse.json({
      synced: rows.length,
      dateRange: { start: startStr, end: endStr },
      message: `Synced ${rows.length} days of profit data`,
    });
  } catch (err) {
    console.error("Profit sync error:", err);
    return apiError("server_error", "Internal server error during profit sync", 500, true);
  }
}
