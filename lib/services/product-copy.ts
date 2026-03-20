import { supabase } from "@/lib/supabase";
import type { ProductCopy } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type ProductCopyRow = {
  id: string;
  store_id: string;
  product_id: string | null;
  research_product_id: string | null;
  product_name: string;
  product_url: string;
  image_url: string;
  ad_status: string;
  shopify_description: string;
  facebook_copy: string;
  size_chart_image_url: string;
  size_chart_table: string;
  size_chart_status: string;
  copy_status: string;
  push_status: string;
  shopify_product_id: string | null;
};

const SELECT_COLS =
  "id, store_id, product_id, research_product_id, product_name, product_url, image_url, ad_status, shopify_description, facebook_copy, size_chart_image_url, size_chart_table, size_chart_status, copy_status, push_status, shopify_product_id";

// ── Mappers ────────────────────────────────────────────────

function rowToProductCopy(row: ProductCopyRow): ProductCopy {
  return {
    id: row.id,
    productId: row.product_id ?? undefined,
    adStatus: (row.ad_status || "red") as ProductCopy["adStatus"],
    productName: row.product_name ?? "",
    productUrl: row.product_url ?? "",
    imageUrl: row.image_url ?? "",
    shopifyDescription: row.shopify_description ?? "",
    facebookCopy: row.facebook_copy ?? "",
    status: (row.copy_status || "") as ProductCopy["status"],
    pushStatus: (row.push_status || "") as ProductCopy["pushStatus"],
    sizeChartImage: row.size_chart_image_url ?? "",
    sizeChartTable: row.size_chart_table ?? "",
    sizeChartStatus: (row.size_chart_status || "") as ProductCopy["sizeChartStatus"],
    shopifyProductId: row.shopify_product_id ?? undefined,
  };
}

function productCopyToRow(
  product: Partial<ProductCopy>,
  storeId: string
): Record<string, unknown> {
  const row: Record<string, unknown> = { store_id: storeId };

  if (product.productName !== undefined) row.product_name = product.productName || "";
  if (product.productUrl !== undefined) row.product_url = product.productUrl || "";
  if (product.imageUrl !== undefined) row.image_url = product.imageUrl || "";
  if (product.adStatus !== undefined) row.ad_status = product.adStatus || "red";
  if (product.shopifyDescription !== undefined) row.shopify_description = product.shopifyDescription || "";
  if (product.facebookCopy !== undefined) row.facebook_copy = product.facebookCopy || "";
  if (product.status !== undefined) row.copy_status = product.status || "";
  if (product.pushStatus !== undefined) row.push_status = product.pushStatus || "";
  if (product.sizeChartImage !== undefined) row.size_chart_image_url = product.sizeChartImage || "";
  if (product.sizeChartTable !== undefined) row.size_chart_table = product.sizeChartTable || "";
  if (product.sizeChartStatus !== undefined) row.size_chart_status = product.sizeChartStatus || "";
  if (product.shopifyProductId !== undefined) row.shopify_product_id = product.shopifyProductId || null;

  return row;
}

// ── Service functions ──────────────────────────────────────

export async function fetchProductCopies(storeId: string, signal?: AbortSignal): Promise<ProductCopy[]> {
  let query = supabase
    .from("product_copies")
    .select(SELECT_COLS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });

  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;

  if (error) {
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    throw new Error(error.message);
  }

  return (data as ProductCopyRow[]).map(rowToProductCopy);
}

export async function createProductCopy(
  storeId: string,
  initial?: Partial<ProductCopy>,
  productId?: string
): Promise<ProductCopy | null> {
  const row: Record<string, unknown> = {
    store_id: storeId,
    product_name: initial?.productName || "",
    product_url: initial?.productUrl || "",
    image_url: initial?.imageUrl || "",
    ad_status: initial?.adStatus || "red",
    shopify_description: "",
    facebook_copy: "",
    copy_status: initial?.status || "",
    push_status: "",
    size_chart_image_url: "",
    size_chart_table: "",
    size_chart_status: "",
    ...(productId ? { product_id: productId, research_product_id: productId } : {}),
  };

  const { data, error } = await supabase
    .from("product_copies")
    .insert(row)
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("Failed to create product copy:", error.message);
    return null;
  }

  return rowToProductCopy(data as ProductCopyRow);
}

export async function updateProductCopy(
  id: string,
  updates: Partial<ProductCopy>,
  storeId: string
): Promise<boolean> {
  const row = productCopyToRow(updates, storeId);
  delete row.store_id;

  const { error } = await supabase
    .from("product_copies")
    .update(row)
    .eq("id", id);

  if (error) {
    console.error("Failed to update product copy:", error.message);
    return false;
  }

  return true;
}

export async function deleteProductCopy(id: string, storeId?: string): Promise<boolean> {
  let query = supabase
    .from("product_copies")
    .delete()
    .eq("id", id);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to delete product copy:", error.message);
    return false;
  }

  return true;
}
