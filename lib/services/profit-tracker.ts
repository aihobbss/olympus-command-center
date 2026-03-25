import { supabase, authFetch } from "@/lib/supabase";
import type { ProfitLog } from "@/data/mock";

// ── DB row shape (snake_case) ──────────────────────────────

type ProfitLogRow = {
  id: string;
  store_id: string;
  date: string;
  revenue_usd: number;
  refunds_usd: number;
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
  product_id: string | null;
  product_name: string;
  cog_usd: number;
};

const LOG_COLS =
  "id, store_id, date, revenue_usd, refunds_usd, cog_usd, ad_spend_usd, transaction_fee_usd, profit_usd, roas, profit_percent, orders, synced_from, created_at";

// ── Mappers ────────────────────────────────────────────────

function rowToLog(row: ProfitLogRow): ProfitLog {
  return {
    date: row.date,
    revenue: row.revenue_usd,
    refunds: row.refunds_usd || 0,
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

export async function fetchCogs(storeId: string): Promise<{
  byName: Record<string, number>;
  byProductId: Record<string, number>;
}> {
  const { data, error } = await supabase
    .from("product_cogs")
    .select("product_id, product_name, cog_usd")
    .eq("store_id", storeId);

  if (error) {
    console.error("Failed to fetch COGs:", error.message);
    return { byName: {}, byProductId: {} };
  }

  const byName: Record<string, number> = {};
  const byProductId: Record<string, number> = {};
  for (const row of (data as ProductCogRow[]) ?? []) {
    byName[row.product_name] = row.cog_usd;
    if (row.product_id) {
      byProductId[row.product_id] = row.cog_usd;
    }
  }
  return { byName, byProductId };
}

export async function upsertCog(
  storeId: string,
  productName: string,
  cogUsd: number,
  productId?: string
): Promise<boolean> {
  const { error } = await supabase
    .from("product_cogs")
    .upsert(
      {
        store_id: storeId,
        product_id: productId || null,
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
  _userId: string,
  storeId: string,
  daysBack?: number,
  adAccountIds?: string[]
): Promise<{ synced: number; error?: string }> {
  // 60s timeout — large syncs (365 days) can take a while
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await authFetch("/api/sync-profit-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, daysBack, adAccountIds }),
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

// ── Inline editing (single field update + recompute) ────

export async function updateProfitLogFields(
  storeId: string,
  date: string,
  fields: { cog_usd?: number; ad_spend_usd?: number }
): Promise<ProfitLog | null> {
  const { data: row, error: fetchErr } = await supabase
    .from("profit_logs")
    .select(LOG_COLS)
    .eq("store_id", storeId)
    .eq("date", date)
    .single();

  if (fetchErr || !row) {
    console.error("Failed to fetch profit log for update:", fetchErr?.message);
    return null;
  }

  const revenue = row.revenue_usd;
  const cog = fields.cog_usd ?? row.cog_usd;
  const adSpend = fields.ad_spend_usd ?? row.ad_spend_usd;
  const txnFee = row.transaction_fee_usd;
  const profit = revenue - cog - adSpend - txnFee;
  const roas = adSpend > 0 ? parseFloat((revenue / adSpend).toFixed(2)) : 0;
  const profitPercent = revenue > 0
    ? parseFloat(((profit / revenue) * 100).toFixed(1))
    : 0;

  const updateData: Record<string, number> = {
    profit_usd: Math.round(profit * 100) / 100,
    roas,
    profit_percent: profitPercent,
  };
  if (fields.cog_usd !== undefined) updateData.cog_usd = Math.round(fields.cog_usd * 100) / 100;
  if (fields.ad_spend_usd !== undefined) updateData.ad_spend_usd = Math.round(fields.ad_spend_usd * 100) / 100;

  const { error: updateErr } = await supabase
    .from("profit_logs")
    .update(updateData)
    .eq("store_id", storeId)
    .eq("date", date);

  if (updateErr) {
    console.error("Failed to update profit log:", updateErr.message);
    return null;
  }

  return rowToLog({
    ...row,
    ...updateData,
    cog_usd: updateData.cog_usd ?? row.cog_usd,
    ad_spend_usd: updateData.ad_spend_usd ?? row.ad_spend_usd,
  } as ProfitLogRow);
}

// ── CSV upload (bulk upsert) ────────────────────────────

export async function uploadProfitLogsCsv(
  storeId: string,
  logs: Array<{
    date: string;
    revenue: number;
    cog: number;
    adSpend: number;
    transactionFee: number;
    orders: number;
  }>
): Promise<{ success: number; failed: number; error?: string }> {
  const rows = logs.map((log) => {
    const profit = log.revenue - log.cog - log.adSpend - log.transactionFee;
    const roas = log.adSpend > 0 ? parseFloat((log.revenue / log.adSpend).toFixed(2)) : 0;
    const profitPercent = log.revenue > 0
      ? parseFloat(((profit / log.revenue) * 100).toFixed(1))
      : 0;

    return {
      store_id: storeId,
      date: log.date,
      revenue_usd: Math.round(log.revenue * 100) / 100,
      refunds_usd: 0,
      cog_usd: Math.round(log.cog * 100) / 100,
      ad_spend_usd: Math.round(log.adSpend * 100) / 100,
      transaction_fee_usd: Math.round(log.transactionFee * 100) / 100,
      profit_usd: Math.round(profit * 100) / 100,
      roas,
      profit_percent: profitPercent,
      orders: log.orders,
      synced_from: "csv_upload",
    };
  });

  // Batch in chunks of 50 to avoid request size / timeout issues
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("profit_logs")
      .upsert(chunk, { onConflict: "store_id,date" });

    if (error) {
      console.error("Failed to upload profit logs:", error.message);
      return { success: i, failed: rows.length - i, error: error.message };
    }
  }

  return { success: rows.length, failed: 0 };
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
