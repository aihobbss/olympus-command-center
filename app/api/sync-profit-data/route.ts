import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getShopifyToken } from "@/lib/shopify-token";

// Profit Data Sync — pulls Shopify orders + Meta ad spend, computes daily P&L
// Writes daily rows to profit_logs table (all values in USD)

const META_API = "https://graph.facebook.com/v19.0";

type DailyBucket = {
  revenue: number;
  orders: number;
  adSpend: number;
};

// Helper: get "today" in a given IANA timezone as YYYY-MM-DD
function todayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

// Helper: generate an array of YYYY-MM-DD date strings in a timezone
function dateRange(daysBack: number, tz: string): string[] {
  const today = todayInTz(tz);
  const dates: string[] = [];
  // Parse today as midnight UTC to do simple day math
  const end = new Date(today + "T12:00:00Z"); // noon to avoid DST edge cases
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86_400_000);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, storeId, daysBack } = body as {
      userId: string;
      storeId: string;
      daysBack?: number;
    };

    if (!userId || !storeId) {
      return NextResponse.json(
        { error: "userId and storeId are required" },
        { status: 400 }
      );
    }

    const days = daysBack || 30;

    // ── 1. Pull Shopify orders ──────────────────────────────

    const shopify = await getShopifyToken(userId, storeId);

    // Fetch store timezone from Shopify so we bucket orders by the store's
    // local date (fixes off-by-one for non-UTC stores like AU/UK).
    let storeTimezone = "UTC";
    if (shopify) {
      try {
        const shopRes = await fetch(
          `https://${shopify.shopifyDomain}/admin/api/2024-01/shop.json`,
          { headers: { "X-Shopify-Access-Token": shopify.accessToken } }
        );
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          storeTimezone = shopData.shop?.iana_timezone || "UTC";
        }
      } catch {
        // Fall back to UTC if we can't fetch timezone
      }
    }

    // Build date range in the STORE'S timezone (not UTC) — this ensures
    // bucket keys match the local dates used for order bucketing below.
    const localDates = dateRange(days, storeTimezone);
    const startStr = localDates[0];
    const endStr = localDates[localDates.length - 1];

    // Initialize daily buckets keyed by store-local dates
    const dailyData = new Map<string, DailyBucket>();
    for (const d of localDates) {
      dailyData.set(d, { revenue: 0, orders: 0, adSpend: 0 });
    }

    if (shopify) {
      try {
        // Query an extra day on each side to account for UTC ↔ local offset
        // (orders near midnight could fall on adjacent UTC day)
        const queryStart = localDates[0]; // already covers the earliest local date
        const queryEnd = endStr;

        // Paginate through all Shopify orders in the date range
        let pageUrl: string | null =
          `https://${shopify.shopifyDomain}/admin/api/2024-01/orders.json` +
          `?status=any&created_at_min=${queryStart}T00:00:00Z&created_at_max=${queryEnd}T23:59:59Z&limit=250`;

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
            // Convert order timestamp to the store's LOCAL date (not UTC)
            // e.g. an order at 2024-11-26T22:00:00Z → Nov 27 in Melbourne (UTC+11)
            const orderDt = new Date(order.created_at);
            if (isNaN(orderDt.getTime())) continue;
            // en-CA locale gives YYYY-MM-DD format
            const date = orderDt.toLocaleDateString("en-CA", { timeZone: storeTimezone });
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

    // ── 2. Pull Meta ad spend (from ALL active ad accounts) ──

    const { data: metaToken } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, meta")
      .eq("user_id", userId)
      .eq("service", "facebook")
      .single();

    if (metaToken?.access_token) {
      // Get all active ad accounts for this user+store
      const { data: adAccounts } = await supabaseAdmin
        .from("user_ad_accounts")
        .select("ad_account_id")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .eq("active", true);

      // Fallback to legacy oauth_tokens.meta if no accounts in new table
      let accountIds: string[] = (adAccounts || []).map((a) => a.ad_account_id);
      if (accountIds.length === 0) {
        const metaData = (metaToken.meta as Record<string, string>) || {};
        if (metaData.ad_account_id) {
          accountIds = [metaData.ad_account_id];
        }
      }

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

    // ── 3. Get store exchange rate ──────────────────────────

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("exchange_rate_to_usd, currency")
      .eq("id", storeId)
      .single();

    const exchangeRate = store?.exchange_rate_to_usd || 1.0;

    // ── 4. Get COGs for this store ──────────────────────────

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

    // ── 5. Compute daily P&L and upsert ─────────────────────

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
        created_at: new Date().toISOString(), // Update on every sync so "last synced" stays fresh
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
      timezone: storeTimezone,
      message: `Synced ${rows.length} days of profit data (tz: ${storeTimezone})`,
    });
  } catch (err) {
    console.error("Profit sync error:", err);
    return NextResponse.json(
      { error: "Internal server error during profit sync" },
      { status: 500 }
    );
  }
}
