import { supabase } from "@/lib/supabase";
import type { AdCreatorCampaign, AdCreative } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type AdCreatorRow = {
  id: string;
  store_id: string;
  product_name: string | null;
  product_url: string | null;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  cta: string | null;
  country: string | null;
  daily_budget: number | null;
  gender: string | null;
  creatives: AdCreative[] | null;
  status: string | null;
  meta_campaign_id: string | null;
};

const SELECT_COLS =
  "id, store_id, product_name, product_url, primary_text, headline, description, cta, country, daily_budget, gender, creatives, status, meta_campaign_id";

// ── Mappers ────────────────────────────────────────────────

function rowToCampaign(row: AdCreatorRow): AdCreatorCampaign {
  return {
    id: row.id,
    productName: row.product_name ?? "",
    productUrl: row.product_url ?? "",
    primaryText: row.primary_text ?? "",
    headline: row.headline ?? "",
    description: row.description ?? "",
    cta: row.cta ?? "Shop Now",
    country: row.country ?? "",
    budget: row.daily_budget ?? 30,
    gender: (row.gender ?? "") as AdCreatorCampaign["gender"],
    creatives: (row.creatives ?? []) as AdCreative[],
    status: (row.status ?? "Queued") as AdCreatorCampaign["status"],
  };
}

function campaignToRow(
  campaign: Partial<AdCreatorCampaign>,
  storeId: string
): Record<string, unknown> {
  const row: Record<string, unknown> = { store_id: storeId };

  if (campaign.productName !== undefined) row.product_name = campaign.productName || null;
  if (campaign.productUrl !== undefined) row.product_url = campaign.productUrl || null;
  if (campaign.primaryText !== undefined) row.primary_text = campaign.primaryText || null;
  if (campaign.headline !== undefined) row.headline = campaign.headline || null;
  if (campaign.description !== undefined) row.description = campaign.description || null;
  if (campaign.cta !== undefined) row.cta = campaign.cta || "Shop Now";
  if (campaign.country !== undefined) row.country = campaign.country || null;
  if (campaign.budget !== undefined) row.daily_budget = campaign.budget;
  if (campaign.gender !== undefined) row.gender = campaign.gender || null;
  if (campaign.creatives !== undefined) row.creatives = JSON.stringify(campaign.creatives);
  if (campaign.status !== undefined) row.status = campaign.status;

  return row;
}

// ── Service functions ──────────────────────────────────────

export async function fetchAdCreatorCampaigns(storeId: string): Promise<AdCreatorCampaign[]> {
  const { data, error } = await supabase
    .from("ad_creator_campaigns")
    .select(SELECT_COLS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch ad creator campaigns:", error.message);
    return [];
  }

  return (data as AdCreatorRow[]).map(rowToCampaign);
}

export async function createAdCreatorCampaign(storeId: string): Promise<AdCreatorCampaign | null> {
  const row: Record<string, unknown> = {
    store_id: storeId,
    product_name: null,
    product_url: null,
    primary_text: null,
    headline: null,
    description: null,
    cta: "Shop Now",
    country: null,
    daily_budget: 30,
    gender: null,
    creatives: "[]",
    status: "Queued",
  };

  const { data, error } = await supabase
    .from("ad_creator_campaigns")
    .insert(row)
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("Failed to create ad creator campaign:", error.message);
    return null;
  }

  return rowToCampaign(data as AdCreatorRow);
}

export async function updateAdCreatorCampaign(
  id: string,
  updates: Partial<AdCreatorCampaign>,
  storeId: string
): Promise<boolean> {
  const row = campaignToRow(updates, storeId);
  delete row.store_id;

  const { error } = await supabase
    .from("ad_creator_campaigns")
    .update(row)
    .eq("id", id);

  if (error) {
    console.error("Failed to update ad creator campaign:", error.message);
    return false;
  }

  return true;
}

export async function deleteAdCreatorCampaign(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("ad_creator_campaigns")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete ad creator campaign:", error.message);
    return false;
  }

  return true;
}
