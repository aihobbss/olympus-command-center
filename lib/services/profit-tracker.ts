import { supabase } from "@/lib/supabase";
import type { ProfitLog } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type ProfitLogRow = {
  id: string;
  store_id: string;
  date: string;
  revenue_usd: number;
  cog_usd: number;
  ad_spend_usd: number;
  transaction_fee_usd: number;
  profit_usd: number;
  roas: number;
  profit_percent: number;
  orders: number;
  synced_from: string | null;
  created_at: string;
};

type ProductCogRow = {
  id: string;
  store_id: string;
  product_name: string;
  cog_usd: number;
};

const LOG_COLS =
  "id, store_id, date, revenue_usd, cog_usd, ad_spend_usd, transaction_fee_usd, profit_usd, roas, profit_percent, orders, synced_from, created_at";

// ── Mappers ────────────────────────────────────────────────

function rowToLog(row: ProfitLogRow): ProfitLog {
  return {
    date: row.date,
    revenue: row.revenue_usd,
    cog: row.cog_usd,
    adSpend: row.ad_spend_usd,
    transactionFee: row.transaction_fee_usd,
    profit: row.profit_usd,
    roas: row.roas,
    profitPercent: row.profit_percent,
    orders: row.orders,
  };
}

// ── Queries ────────────────────────────────────────────────

export async function fetchProfitLogs(storeId: string): Promise<ProfitLog[]> {
  const { data, error } = await supabase
    .from("profit_logs")
    .select(LOG_COLS)
    .eq("store_id", storeId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Failed to fetch profit logs:", error.message);
    return [];
  }

  return (data as ProfitLogRow[]).map(rowToLog);
}

export async function fetchProfitLogsByDateRange(
  storeId: string,
  startDate: string,
  endDate: string
): Promise<ProfitLog[]> {
  const { data, error } = await supabase
    .from("profit_logs")
    .select(LOG_COLS)
    .eq("store_id", storeId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) {
    console.error("Failed to fetch profit logs by date range:", error.message);
    return [];
  }

  return (data as ProfitLogRow[]).map(rowToLog);
}

// ── COG Management ─────────────────────────────────────────

export async function fetchCogs(storeId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("product_cogs")
    .select("product_name, cog_usd")
    .eq("store_id", storeId);

  if (error) {
    console.error("Failed to fetch COGs:", error.message);
    return {};
  }

  const result: Record<string, number> = {};
  for (const row of (data as ProductCogRow[]) ?? []) {
    result[row.product_name] = row.cog_usd;
  }
  return result;
}

export async function upsertCog(
  storeId: string,
  productName: string,
  cogUsd: number
): Promise<boolean> {
  const { error } = await supabase
    .from("product_cogs")
    .upsert(
      {
        store_id: storeId,
        product_name: productName,
        cog_usd: cogUsd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id,product_name" }
    );

  if (error) {
    console.error("Failed to upsert COG:", error.message);
    return false;
  }

  return true;
}

// ── Sync trigger (calls API route) ────────────────────────

export async function triggerProfitSync(
  userId: string,
  storeId: string,
  daysBack?: number
): Promise<{ synced: number; error?: string }> {
  const res = await fetch("/api/sync-profit-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, storeId, daysBack }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { synced: 0, error: data.error || "Sync failed" };
  }

  return { synced: data.synced };
}

export async function getLastProfitSync(storeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profit_logs")
    .select("created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.created_at;
}
