import { supabase } from "@/lib/supabase";
import type { ProductCreative, BatchQueueProduct } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type CreativeRow = {
  id: string;
  store_id: string;
  product_name: string | null;
  prompt_template: string | null;
  prompt: string | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  type: string;
  status: string;
  reference_image_url: string | null;
  created_at: string;
};

const SELECT_COLS =
  "id, store_id, product_name, prompt_template, prompt, asset_url, thumbnail_url, type, status, reference_image_url, created_at";

// Placeholder gradients for creatives without thumbnails
const GRADIENTS = [
  "from-indigo-600 to-purple-500",
  "from-emerald-600 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-600 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-violet-600 to-fuchsia-500",
];

// ── Mappers ────────────────────────────────────────────────

function rowToCreative(row: CreativeRow, idx: number): ProductCreative {
  return {
    id: row.id,
    productName: row.product_name ?? "",
    productCopyId: "", // Not stored in creatives table; linked by product_name
    concept: row.prompt_template ?? "",
    placeholderGradient: GRADIENTS[idx % GRADIENTS.length],
    status: row.status === "saved" || row.status === "ready"
      ? "completed"
      : row.status === "generating"
        ? "generating"
        : "pending",
  };
}

// ── Queries ────────────────────────────────────────────────

export async function fetchCreatives(storeId: string): Promise<ProductCreative[]> {
  const { data, error } = await supabase
    .from("creatives")
    .select(SELECT_COLS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch creatives:", error.message);
    return [];
  }

  return (data as CreativeRow[]).map((row, idx) => rowToCreative(row, idx));
}

export async function fetchSavedCreatives(storeId: string): Promise<ProductCreative[]> {
  const { data, error } = await supabase
    .from("creatives")
    .select(SELECT_COLS)
    .eq("store_id", storeId)
    .eq("status", "saved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch saved creatives:", error.message);
    return [];
  }

  return (data as CreativeRow[]).map((row, idx) => rowToCreative(row, idx));
}

export async function createCreative(
  storeId: string,
  creative: {
    productName: string;
    promptTemplate: string;
    prompt: string;
    referenceImageUrl?: string;
  }
): Promise<ProductCreative | null> {
  const row = {
    store_id: storeId,
    product_name: creative.productName,
    prompt_template: creative.promptTemplate,
    prompt: creative.prompt,
    reference_image_url: creative.referenceImageUrl || null,
    status: "generating",
    type: "image",
  };

  const { data, error } = await supabase
    .from("creatives")
    .insert(row)
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("Failed to create creative:", error.message);
    return null;
  }

  return rowToCreative(data as CreativeRow, 0);
}

export async function updateCreativeStatus(
  id: string,
  status: "generating" | "ready" | "saved" | "archived",
  assetUrl?: string
): Promise<boolean> {
  const updates: Record<string, unknown> = { status };
  if (assetUrl) {
    updates.asset_url = assetUrl;
    updates.thumbnail_url = assetUrl;
  }

  const { error } = await supabase
    .from("creatives")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Failed to update creative status:", error.message);
    return false;
  }

  return true;
}

export async function deleteCreative(id: string, storeId?: string): Promise<boolean> {
  let query = supabase
    .from("creatives")
    .delete()
    .eq("id", id);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to delete creative:", error.message);
    return false;
  }

  return true;
}

// ── Batch Queue (derived from product_copies with push_status = 'pushed') ──

export async function fetchBatchQueue(storeId: string): Promise<BatchQueueProduct[]> {
  const { data, error } = await supabase
    .from("product_copies")
    .select("id, store_id, product_name, product_url, image_url, push_status")
    .eq("store_id", storeId)
    .eq("push_status", "pushed")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch batch queue:", error.message);
    return [];
  }

  // Check which products already have creatives
  const { data: existingCreatives } = await supabase
    .from("creatives")
    .select("product_name, status")
    .eq("store_id", storeId);

  const creativesByProduct = new Map<string, string>();
  for (const c of existingCreatives ?? []) {
    if (c.product_name) {
      creativesByProduct.set(c.product_name, c.status);
    }
  }

  return (data ?? []).map((row) => {
    const existingStatus = creativesByProduct.get(row.product_name ?? "");
    let status: BatchQueueProduct["status"] = "queued";
    if (existingStatus === "generating") status = "generating";
    else if (existingStatus === "ready" || existingStatus === "saved") status = "completed";

    return {
      id: `bq-${row.id}`,
      productCopyId: row.id,
      productName: row.product_name ?? "",
      productUrl: row.product_url ?? "",
      imageUrl: row.image_url ?? "",
      status,
    };
  });
}
