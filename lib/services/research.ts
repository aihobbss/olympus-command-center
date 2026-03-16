import { supabase } from "@/lib/supabase";
import type { SheetProduct } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type ResearchRow = {
  id: string;
  store_id: string;
  product_name: string | null;
  ad_link: string | null;
  store_link: string | null;
  creative_urls: string[] | null;
  testing_status: string | null;
  creative_saved: boolean;
  cog: number | null;
  product_type: string | null;
  pricing: number | null;
  discount_percent: number | null;
  notes: string | null;
};

// ── Mappers ────────────────────────────────────────────────

function rowToSheet(row: ResearchRow): SheetProduct {
  return {
    id: row.id,
    productName: row.product_name ?? "",
    adLink: row.ad_link ?? "",
    storeLink: row.store_link ?? "",
    creativeUrls: row.creative_urls ?? [],
    testingStatus: (row.testing_status ?? "") as SheetProduct["testingStatus"],
    creativeSaved: row.creative_saved,
    cog: row.cog,
    productType: (row.product_type ?? "") as SheetProduct["productType"],
    pricing: row.pricing,
    discountPercent: row.discount_percent ?? 42,
    notes: row.notes ?? "",
  };
}

function sheetToRow(
  product: Partial<SheetProduct>,
  storeId: string
): Record<string, unknown> {
  const row: Record<string, unknown> = { store_id: storeId };

  if (product.productName !== undefined) row.product_name = product.productName || null;
  if (product.adLink !== undefined) row.ad_link = product.adLink || null;
  if (product.storeLink !== undefined) row.store_link = product.storeLink || null;
  if (product.creativeUrls !== undefined) row.creative_urls = product.creativeUrls;
  if (product.testingStatus !== undefined) row.testing_status = product.testingStatus || null;
  if (product.creativeSaved !== undefined) row.creative_saved = product.creativeSaved;
  if (product.cog !== undefined) row.cog = product.cog;
  if (product.productType !== undefined) row.product_type = product.productType || null;
  if (product.pricing !== undefined) row.pricing = product.pricing;
  if (product.discountPercent !== undefined) row.discount_percent = product.discountPercent;
  if (product.notes !== undefined) row.notes = product.notes || null;

  return row;
}

// ── Service functions ──────────────────────────────────────

const SELECT_COLS = "id, store_id, product_name, ad_link, store_link, creative_urls, testing_status, creative_saved, cog, product_type, pricing, discount_percent, notes";

export async function fetchResearchProducts(storeId: string, signal?: AbortSignal): Promise<SheetProduct[]> {
  let query = supabase
    .from("research_products")
    .select(SELECT_COLS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });

  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch research products:", error.message);
    return [];
  }

  return (data as ResearchRow[]).map(rowToSheet);
}

export async function createResearchProduct(storeId: string): Promise<SheetProduct | null> {
  const { data, error } = await supabase
    .from("research_products")
    .insert({
      store_id: storeId,
      product_name: null,
      ad_link: null,
      store_link: null,
      creative_urls: [],
      testing_status: null,
      creative_saved: false,
      cog: null,
      product_type: null,
      pricing: null,
      discount_percent: 42,
      notes: null,
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("Failed to create research product:", error.message);
    return null;
  }

  return rowToSheet(data as ResearchRow);
}

export async function updateResearchProduct(
  id: string,
  updates: Partial<SheetProduct>,
  storeId: string
): Promise<boolean> {
  const row = sheetToRow(updates, storeId);
  // Remove store_id from update payload (shouldn't change)
  delete row.store_id;

  const { error } = await supabase
    .from("research_products")
    .update(row)
    .eq("id", id);

  if (error) {
    console.error("Failed to update research product:", error.message);
    return false;
  }

  return true;
}

export async function deleteResearchProduct(id: string, storeId?: string): Promise<boolean> {
  let query = supabase
    .from("research_products")
    .delete()
    .eq("id", id);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to delete research product:", error.message);
    return false;
  }

  return true;
}

export async function bulkUpdateStatus(
  ids: string[],
  status: string,
  storeId?: string
): Promise<boolean> {
  let query = supabase
    .from("research_products")
    .update({ testing_status: status })
    .in("id", ids);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to bulk update status:", error.message);
    return false;
  }

  return true;
}
