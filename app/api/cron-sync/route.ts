import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Cron Sync Endpoint — triggered by Vercel Cron every hour (0 * * * *)
// Checks each store's timezone and only syncs stores where it's currently midnight (00:xx).
// Runs Meta campaign sync + profit data sync in parallel per store.
// Protected by a shared secret in the Authorization header.

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Check if it's midnight (hour 0) in the given IANA timezone right now.
 * Returns true if the current hour in that timezone is 0 (00:xx).
 */
function isMidnightInTimezone(timezone: string): boolean {
  try {
    const now = new Date();
    // Get the current hour in the store's timezone using Intl
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(now);
    // Intl returns "24" for midnight in some locales, normalize to 0
    const hour = parseInt(hourStr, 10) % 24;
    return hour === 0;
  } catch {
    // Invalid timezone — skip this store
    return false;
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { storeId: string; storeName: string; timezone: string; meta?: string; profit?: string; skipped?: boolean; error?: string }[] = [];

  try {
    // Get all stores with owners and their timezone
    const { data: stores } = await supabaseAdmin
      .from("stores")
      .select("id, name, owner_id, timezone");

    if (!stores || stores.length === 0) {
      return NextResponse.json({ message: "No stores to sync", results: [] });
    }

    // Filter to only stores where it's currently midnight in their timezone
    const storesToSync = stores.filter((store) => {
      if (!store.owner_id) return false;
      // Use store's timezone (populated from Shopify's iana_timezone during connection)
      // Fall back to UTC if no timezone is set
      const tz = store.timezone || "UTC";
      return isMidnightInTimezone(tz);
    });

    // Log skipped stores for debugging
    const skippedStores = stores.filter((s) => !storesToSync.includes(s));
    for (const store of skippedStores) {
      results.push({
        storeId: store.id,
        storeName: store.name,
        timezone: store.timezone || "UTC",
        skipped: true,
      });
    }

    if (storesToSync.length === 0) {
      return NextResponse.json({
        message: "No stores at midnight — nothing to sync",
        timestamp: new Date().toISOString(),
        results,
      });
    }

    // Sync all midnight stores in parallel
    const syncPromises = storesToSync.map(async (store) => {
      const tz = store.timezone || "UTC";
      const storeResult: typeof results[0] = {
        storeId: store.id,
        storeName: store.name,
        timezone: tz,
      };

      try {
        // Run Meta campaign sync and Profit sync in parallel for this store
        const [metaRes, profitRes] = await Promise.allSettled([
          // Meta campaign sync (last 7 days)
          (async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60_000);
            try {
              const res = await fetch(new URL("/api/sync-meta-campaigns", request.url), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${CRON_SECRET}`,
                  "X-Internal-User-Id": store.owner_id,
                },
                body: JSON.stringify({
                  storeId: store.id,
                  datePreset: "last_7d",
                }),
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (res.ok) {
                const data = await res.json();
                return `Synced ${data.synced ?? 0} campaigns`;
              }
              return `Failed: ${res.status}`;
            } catch (err) {
              clearTimeout(timeout);
              return `Error: ${String(err)}`;
            }
          })(),
          // Profit data sync (1 day — daily end-of-day sync)
          (async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60_000);
            try {
              const res = await fetch(new URL("/api/sync-profit-data", request.url), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${CRON_SECRET}`,
                  "X-Internal-User-Id": store.owner_id,
                },
                body: JSON.stringify({
                  storeId: store.id,
                  daysBack: 1,
                }),
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (res.ok) {
                const data = await res.json();
                return `Synced ${data.synced ?? 0} days`;
              }
              return `Failed: ${res.status}`;
            } catch (err) {
              clearTimeout(timeout);
              return `Error: ${String(err)}`;
            }
          })(),
        ]);

        storeResult.meta = metaRes.status === "fulfilled" ? metaRes.value : `Error: ${metaRes.reason}`;
        storeResult.profit = profitRes.status === "fulfilled" ? profitRes.value : `Error: ${profitRes.reason}`;
      } catch (err) {
        storeResult.error = String(err);
      }

      return storeResult;
    });

    const syncResults = await Promise.all(syncPromises);
    results.push(...syncResults);

    const syncedCount = syncResults.filter((r) => !r.error).length;
    return NextResponse.json({
      message: `Cron sync completed for ${syncedCount} store(s) at midnight`,
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
