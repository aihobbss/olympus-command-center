import { supabase, authFetch } from "@/lib/supabase";
import type { AdCampaign } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type AdCampaignRow = {
  id: string;
  store_id: string;
  product_id: string | null;
  meta_campaign_id: string | null;
  ad_account_id: string | null;
  campaign_name: string | null;
  product: string | null;
  spend: number;
  budget: number;
  cpc: number;
  ctr: number;
  atc: number;
  roas: number;
  revenue: number;
  orders: number;
  profit: number;
  status: string | null;
  recommendation: string | null;
  recommendation_reason: string | null;
  last_synced_at: string | null;
  budget_history: unknown;
};

export type DailyInsightRow = {
  id: string;
  store_id: string;
  meta_campaign_id: string;
  ad_account_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  ctr: number;
  atc: number;
  purchases: number;
  purchase_value: number;
};

// Aggregated metrics for a campaign over a date range
export type CampaignPeriodMetrics = {
  metaCampaignId: string;
  spend: number;
  impressions: number;
  clicks: number;
  atc: number;
  purchases: number;
  purchaseValue: number;
  cpc: number;
  ctr: number;
};

// Store-wide aggregated metrics over a date range
export type StorePeriodMetrics = {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalAtc: number;
  totalPurchases: number;
  totalPurchaseValue: number;
  avgCpc: number;
  avgCtr: number;
  byCampaign: Map<string, CampaignPeriodMetrics>;
};

const CAMPAIGN_SELECT_COLS =
  "id, store_id, product_id, meta_campaign_id, ad_account_id, campaign_name, product, spend, budget, cpc, ctr, atc, roas, revenue, orders, profit, status, recommendation, recommendation_reason, last_synced_at, budget_history";

// ── Mappers ────────────────────────────────────────────────

function rowToCampaign(row: AdCampaignRow): AdCampaign {
  return {
    id: row.id,
    metaCampaignId: row.meta_campaign_id ?? undefined,
    productId: row.product_id ?? undefined,
    campaignName: row.campaign_name ?? "",
    product: row.product ?? "",
    adAccountId: row.ad_account_id ?? undefined,
    spend: row.spend ?? 0,
    budget: row.budget ?? 0,
    cpc: row.cpc ?? 0,
    atc: row.atc ?? 0,
    roas: row.roas ?? 0,
    revenue: row.revenue ?? 0,
    orders: row.orders ?? 0,
    profit: row.profit ?? 0,
    status: (row.recommendation as AdCampaign["status"]) ?? "Watch",
    campaignStatus: (row.status as AdCampaign["campaignStatus"]) ?? "Active",
    recommendation: row.recommendation ?? "",
    budgetHistory: Array.isArray(row.budget_history) ? row.budget_history : [],
  };
}

// ── Campaign metadata queries ──────────────────────────────

export async function fetchLiveCampaigns(storeId: string): Promise<AdCampaign[]> {
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select(CAMPAIGN_SELECT_COLS)
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch live campaigns:", error.message);
    return [];
  }

  return (data as AdCampaignRow[]).map(rowToCampaign);
}

export async function getLastSyncedAt(storeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select("last_synced_at")
    .eq("store_id", storeId)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.last_synced_at;
}

// ── Daily insights queries ─────────────────────────────────

/**
 * Fetch daily insight rows for a store within a date range,
 * optionally filtered by ad account IDs.
 */
export async function fetchDailyInsights(
  storeId: string,
  startDate: string,
  endDate: string,
  adAccountIds?: string[]
): Promise<DailyInsightRow[]> {
  let query = supabase
    .from("ad_campaign_daily_insights")
    .select("id, store_id, meta_campaign_id, ad_account_id, date, spend, impressions, clicks, cpc, ctr, atc, purchases, purchase_value")
    .eq("store_id", storeId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (adAccountIds && adAccountIds.length > 0) {
    query = query.in("ad_account_id", adAccountIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch daily insights:", error.message);
    return [];
  }

  return (data as DailyInsightRow[]) ?? [];
}

/**
 * Aggregate daily insight rows into store-wide and per-campaign metrics.
 */
export function aggregateDailyInsights(rows: DailyInsightRow[]): StorePeriodMetrics {
  const byCampaign = new Map<string, CampaignPeriodMetrics>();

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalAtc = 0;
  let totalPurchases = 0;
  let totalPurchaseValue = 0;

  for (const row of rows) {
    totalSpend += row.spend;
    totalImpressions += row.impressions;
    totalClicks += row.clicks;
    totalAtc += row.atc;
    totalPurchases += row.purchases;
    totalPurchaseValue += row.purchase_value;

    const existing = byCampaign.get(row.meta_campaign_id);
    if (existing) {
      existing.spend += row.spend;
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.atc += row.atc;
      existing.purchases += row.purchases;
      existing.purchaseValue += row.purchase_value;
    } else {
      byCampaign.set(row.meta_campaign_id, {
        metaCampaignId: row.meta_campaign_id,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        atc: row.atc,
        purchases: row.purchases,
        purchaseValue: row.purchase_value,
        cpc: 0, // computed below
        ctr: 0,
      });
    }
  }

  // Compute derived metrics per campaign
  Array.from(byCampaign.values()).forEach((metrics) => {
    metrics.cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
    metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
  });

  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalAtc,
    totalPurchases,
    totalPurchaseValue,
    avgCpc,
    avgCtr,
    byCampaign,
  };
}

// ── Sync trigger (calls API route) ────────────────────────

export async function triggerMetaSync(
  _userId: string,
  storeId: string,
  options?: { forceFullSync?: boolean; adAccountIds?: string[] }
): Promise<{ synced: number; error?: string }> {
  // First sync pulls ~37 months in 90-day chunks across multiple accounts — can take a while
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const res = await authFetch("/api/sync-meta-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        forceFullSync: options?.forceFullSync,
        adAccountIds: options?.adAccountIds,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await res.json();

    if (!res.ok) {
      return { synced: 0, error: data.error || "Sync failed" };
    }

    return { synced: data.synced };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { synced: -1 };
    }
    throw err;
  }
}

// ── Campaign actions (calls API route) ────────────────────

export async function killCampaign(
  userId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await authFetch("/api/meta-campaign-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, campaignId, action: "kill" }),
  });

  const data = await res.json();
  return { success: res.ok, error: data.error };
}

export async function scaleCampaign(
  userId: string,
  campaignId: string,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  const res = await authFetch("/api/meta-campaign-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, campaignId, action: "scale", newBudget }),
  });

  const data = await res.json();
  return { success: res.ok, error: data.error };
}

export async function passCampaign(
  userId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await authFetch("/api/meta-campaign-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, campaignId, action: "pass" }),
  });

  const data = await res.json();
  return { success: res.ok, error: data.error };
}
