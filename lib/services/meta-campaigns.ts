import { supabase, authFetch } from "@/lib/supabase";
import type { AdCampaign } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type AdCampaignRow = {
  id: string;
  store_id: string;
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

const SELECT_COLS =
  "id, store_id, meta_campaign_id, ad_account_id, campaign_name, product, spend, budget, cpc, ctr, atc, roas, revenue, orders, profit, status, recommendation, recommendation_reason, last_synced_at, budget_history";

// ── Mappers ────────────────────────────────────────────────

function rowToCampaign(row: AdCampaignRow): AdCampaign {
  return {
    id: row.id,
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
    status: (row.status as AdCampaign["status"]) ?? "Watch",
    campaignStatus: (row.status as AdCampaign["campaignStatus"]) ?? "Active",
    recommendation: row.recommendation ?? "",
    budgetHistory: Array.isArray(row.budget_history) ? row.budget_history : [],
  };
}

// ── Queries ────────────────────────────────────────────────

export async function fetchLiveCampaigns(storeId: string): Promise<AdCampaign[]> {
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select(SELECT_COLS)
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

// ── Sync trigger (calls API route) ────────────────────────

export async function triggerMetaSync(
  userId: string,
  storeId: string,
  datePreset?: string
): Promise<{ synced: number; error?: string }> {
  // 30s timeout — Meta syncs can be slow but shouldn't block indefinitely
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await authFetch("/api/sync-meta-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, storeId, datePreset }),
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
    // If the request timed out, the server may still have written data
    if (err instanceof DOMException && err.name === "AbortError") {
      return { synced: -1 }; // signal to caller: data may exist, reload
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
