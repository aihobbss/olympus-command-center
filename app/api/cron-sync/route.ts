import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Cron Sync Endpoint — triggered by Supabase pg_cron or external scheduler (e.g. Vercel Cron)
// Syncs Meta campaigns + profit data for all active stores
// Protected by a shared secret in the Authorization header

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { storeId: string; storeName: string; meta?: string; profit?: string; error?: string }[] = [];

  try {
    // Get all stores with owners who have both Meta and Shopify tokens
    const { data: stores } = await supabaseAdmin
      .from("stores")
      .select("id, name, owner_id");

    if (!stores || stores.length === 0) {
      return NextResponse.json({ message: "No stores to sync", results: [] });
    }

    for (const store of stores) {
      if (!store.owner_id) continue;

      const storeResult: typeof results[0] = { storeId: store.id, storeName: store.name };

      try {
        // 1. Sync Meta campaigns (last 7 days)
        const metaController = new AbortController();
        const metaTimeout = setTimeout(() => metaController.abort(), 60_000);
        const metaRes = await fetch(new URL("/api/sync-meta-campaigns", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: store.owner_id,
            storeId: store.id,
            datePreset: "last_7d",
          }),
          signal: metaController.signal,
        });
        clearTimeout(metaTimeout);

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          storeResult.meta = `Synced ${metaData.synced ?? 0} campaigns`;
        } else {
          storeResult.meta = `Failed: ${metaRes.status}`;
        }
      } catch (err) {
        storeResult.meta = `Error: ${String(err)}`;
      }

      try {
        // 2. Sync profit data (last 7 days)
        const profitController = new AbortController();
        const profitTimeout = setTimeout(() => profitController.abort(), 60_000);
        const profitRes = await fetch(new URL("/api/sync-profit-data", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: store.owner_id,
            storeId: store.id,
            daysBack: 7,
          }),
          signal: profitController.signal,
        });
        clearTimeout(profitTimeout);

        if (profitRes.ok) {
          const profitData = await profitRes.json();
          storeResult.profit = `Synced ${profitData.synced ?? 0} days`;
        } else {
          storeResult.profit = `Failed: ${profitRes.status}`;
        }
      } catch (err) {
        storeResult.profit = `Error: ${String(err)}`;
      }

      results.push(storeResult);
    }

    return NextResponse.json({
      message: `Cron sync completed for ${results.length} stores`,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err) {
    console.error("Cron sync error:", err);
    return NextResponse.json(
      { error: "Cron sync failed", details: String(err) },
      { status: 500 }
    );
  }
}
