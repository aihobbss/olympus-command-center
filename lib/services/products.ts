import { supabase } from "@/lib/supabase";
import type { SheetProduct } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type ProductRow = {
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
  compare_at_price: number | null;
  notes: string | null;
  pipeline_status: string | null;
  shopify_product_id: string | null;
};

// ── Mappers ────────────────────────────────────────────────

function rowToProduct(row: ProductRow): SheetProduct {
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
    compareAtPrice: row.compare_at_price,
    notes: row.notes ?? "",
    pipelineStatus: (row.pipeline_status ?? "research") as SheetProduct["pipelineStatus"],
    shopifyProductId: row.shopify_product_id ?? undefined,
  };
}

function productToRow(
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
  if (product.compareAtPrice !== undefined) row.compare_at_price = product.compareAtPrice;
  if (product.notes !== undefined) row.notes = product.notes || null;
  if (product.pipelineStatus !== undefined) row.pipeline_status = product.pipelineStatus;
  if (product.shopifyProductId !== undefined) row.shopify_product_id = product.shopifyProductId || null;

  return row;
}

// ── Service functions ──────────────────────────────────────

const SELECT_COLS = "id, store_id, product_name, ad_link, store_link, creative_urls, testing_status, creative_saved, cog, product_type, pricing, discount_percent, compare_at_price, notes, pipeline_status, shopify_product_id";

export async function fetchProducts(storeId: string, signal?: AbortSignal): Promise<SheetProduct[]> {
  let query = supabase
    .from("products")
    .select(SELECT_COLS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });

  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;

  if (error) {
    // If the caller's signal was aborted, throw a proper AbortError so the store
    // can distinguish cancellation from real failures and preserve cached data.
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    throw new Error(error.message);
  }

  return (data as ProductRow[]).map(rowToProduct);
}

export async function createProduct(storeId: string): Promise<SheetProduct | null> {
  const { data, error } = await supabase
    .from("products")
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
      compare_at_price: null,
      notes: null,
      pipeline_status: "research",
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("Failed to create product:", error.message);
    return null;
  }

  return rowToProduct(data as ProductRow);
}

export async function updateProduct(
  id: string,
  updates: Partial<SheetProduct>,
  storeId: string
): Promise<boolean> {
  const row = productToRow(updates, storeId);
  // Remove store_id from update payload (shouldn't change)
  delete row.store_id;

  const { error } = await supabase
    .from("products")
    .update(row)
    .eq("id", id);

  if (error) {
    console.error("Failed to update product:", error.message);
    return false;
  }

  return true;
}

export async function deleteProduct(id: string, storeId?: string): Promise<boolean> {
  let query = supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to delete product:", error.message);
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
    .from("products")
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

// Legacy re-exports for backwards compatibility during migration
export {
  fetchProducts as fetchResearchProducts,
  createProduct as createResearchProduct,
  updateProduct as updateResearchProduct,
  deleteProduct as deleteResearchProduct,
};
