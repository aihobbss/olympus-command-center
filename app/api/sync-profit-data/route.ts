import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getShopifyToken } from "@/lib/shopify-token";

// Profit Data Sync — pulls Shopify orders + Meta ad spend, computes daily P&L
// Writes daily rows to profit_logs table (all values in USD)

const META_API = "https://graph.facebook.com/v19.0";

// Map store market to IANA timezone for correct local-date extraction
const MARKET_TIMEZONE: Record<string, string> = {
  AU: "Australia/Melbourne",
  UK: "Europe/London",
  US: "America/New_York",
};

type DailyBucket = {
  revenue: number;
  orders: number;
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

    const days = daysBack || 30;

    // ── 0. Get store info (need timezone before processing orders) ──

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("exchange_rate_to_usd, currency, market")
      .eq("id", storeId)
      .single();

    const exchangeRate = store?.exchange_rate_to_usd || 1.0;
    const storeTimezone = MARKET_TIMEZONE[store?.market ?? ""] || "UTC";

    // Helper: extract YYYY-MM-DD in the store's local timezone from any ISO timestamp
    const toLocalDate = (isoTimestamp: string): string => {
      const d = new Date(isoTimestamp);
      // en-CA locale returns YYYY-MM-DD format
      return d.toLocaleDateString("en-CA", { timeZone: storeTimezone });
    };

    // Compute date range in the store's local timezone
    const now = new Date();
    const endStr = toLocalDate(now.toISOString());
    const startMs = now.getTime() - days * 86_400_000;
    const startStr = toLocalDate(new Date(startMs).toISOString());

    // Initialize daily buckets using store-local dates
    const dailyData = new Map<string, DailyBucket>();
    {
      const d = new Date(startMs);
      // Iterate with some padding to cover timezone edges
      const endMs = now.getTime() + 86_400_000;
      while (d.getTime() <= endMs) {
        const localDate = toLocalDate(d.toISOString());
        if (!dailyData.has(localDate)) {
          dailyData.set(localDate, { revenue: 0, orders: 0, adSpend: 0 });
        }
        d.setTime(d.getTime() + 86_400_000);
      }
    }

    // ── 1. Pull Shopify orders ──────────────────────────────

    const shopify = await getShopifyToken(userId, storeId);

    if (shopify) {
      {
        try {
          // Paginate through all Shopify orders in the date range
          let pageUrl: string | null =
            `https://${shopify.shopifyDomain}/admin/api/2024-01/orders.json` +
            `?status=any&created_at_min=${startStr}T00:00:00Z&created_at_max=${endStr}T23:59:59Z&limit=250`;

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
              const totalPrice = parseFloat(order.total_price || "0");

              // Subtract refunds for accurate net revenue
              let refundTotal = 0;
              if (order.refunds && Array.isArray(order.refunds)) {
                for (const refund of order.refunds) {
                  if (refund.transactions && Array.isArray(refund.transactions)) {
                    for (const txn of refund.transactions) {
                      refundTotal += parseFloat(txn.amount || "0");
                    }
                  }
                }
              }

              bucket.revenue += totalPrice - refundTotal;
              bucket.orders += 1;
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
    }

    // ── 2. Pull Meta ad spend (from selected ad accounts) ─────

    const { data: metaToken } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, meta")
      .eq("user_id", userId)
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
          .eq("user_id", userId)
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

    // ── 4. Compute daily P&L and upsert ─────────────────────

    const rows = [];
    for (const [date, bucket] of Array.from(dailyData.entries())) {
      // Skip days with no data
      if (bucket.revenue === 0 && bucket.adSpend === 0 && bucket.orders === 0) continue;

      // Revenue comes in store currency, convert to USD
      const revenueUsd = bucket.revenue * exchangeRate;
      // Ad spend is already in USD (Meta reports in account currency, usually USD)
      const adSpendUsd = bucket.adSpend;
      // COG estimate
      const cogUsd = bucket.orders * avgCogPerOrder;
      // Transaction fee: 2.9% + $0.30 per order
      const transactionFeeUsd = revenueUsd * 0.029 + bucket.orders * 0.3;
      // Profit
      const profitUsd = revenueUsd - cogUsd - adSpendUsd - transactionFeeUsd;
      // ROAS
      const roas = adSpendUsd > 0 ? parseFloat((revenueUsd / adSpendUsd).toFixed(2)) : 0;
      // Profit %
      const profitPercent = revenueUsd > 0
        ? parseFloat(((profitUsd / revenueUsd) * 100).toFixed(1))
        : 0;

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
