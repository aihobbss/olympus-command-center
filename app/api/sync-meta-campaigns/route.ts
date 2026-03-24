import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

// Allow up to 5 minutes for first sync (37 months in 90-day chunks across multiple accounts)
export const maxDuration = 300;

// Meta Graph API v19.0 — Campaign sync
// Two-phase sync:
//   Phase A: Upsert campaign metadata into ad_campaigns (name, status, budget)
//   Phase B: Upsert daily insights into ad_campaign_daily_insights (spend, atc, etc.)
//
// First sync (no existing daily insights): pulls "maximum" date range (~37 months)
// Subsequent syncs: pulls last 7 days to capture Meta's attribution window updates

const META_API = "https://graph.facebook.com/v19.0";

// Fields for daily insights (time_increment=1)
const INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "spend",
  "cpc",
  "ctr",
  "actions",
  "action_values",
  "impressions",
  "clicks",
].join(",");

// Fields for campaign metadata
const CAMPAIGN_FIELDS = ["id", "name", "status", "daily_budget"].join(",");

type MetaDailyInsight = {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend: string;
  cpc?: string;
  ctr?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
};

type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
};

function getActionValue(
  actions: { action_type: string; value: string }[] | undefined,
  type: string
): number {
  if (!actions) return 0;
  const action = actions.find((a) => a.action_type === type);
  return action ? parseFloat(action.value) : 0;
}

// Fetch all pages of a paginated Meta API response
async function fetchAllPages<T>(
  url: string,
  accessToken: string,
  label?: string
): Promise<{ data: T[]; error?: string }> {
  const all: T[] = [];
  let nextUrl: string | null = url;
  let pageNum = 0;

  while (nextUrl) {
    pageNum++;
    const res: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg = (errBody as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
      console.error(`[fetchAllPages] ${label || "unknown"} page ${pageNum} failed:`, errMsg);
      return { data: all, error: errMsg };
    }

    const json: { data?: T[]; paging?: { next?: string } } = await res.json();
    const data = (json.data || []) as T[];
    all.push(...data);

    nextUrl = json.paging?.next || null;
  }

  return { data: all };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, forceFullSync } = body as {
      storeId: string;
      forceFullSync?: boolean;
    };

    if (!storeId) {
      return apiError("missing_field", "storeId is required", 400);
    }

    const authResult = await verifyApiUser(request, storeId);
    if ("error" in authResult) {
      return apiError("auth_failed", authResult.error, authResult.status);
    }
    const verifiedUserId = authResult.userId;

    // 1. Get user's Meta access token (scoped to store)
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, expires_at, meta")
      .eq("user_id", verifiedUserId)
      .eq("store_id", storeId)
      .eq("service", "facebook")
      .single();

    if (tokenError || !tokenRow?.access_token) {
      return apiError(
        "meta_not_connected",
        "Meta not connected. Please connect your Facebook account in Settings.",
        401
      );
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return apiError(
        "meta_token_expired",
        "Meta token expired. Please reconnect Facebook in Settings.",
        401
      );
    }

    const accessToken = tokenRow.access_token;

    // 2. Get all active ad accounts for this user+store
    const { data: adAccounts } = await supabaseAdmin
      .from("user_ad_accounts")
      .select("ad_account_id, account_name")
      .eq("user_id", verifiedUserId)
      .eq("store_id", storeId)
      .eq("active", true);

    let accountsToSync: { ad_account_id: string; account_name: string }[] =
      adAccounts || [];

    // Fallback: legacy oauth_tokens.meta
    if (accountsToSync.length === 0) {
      const metaData = (tokenRow.meta as Record<string, string>) || {};
      if (metaData.ad_account_id) {
        await supabaseAdmin.from("user_ad_accounts").upsert(
          {
            user_id: verifiedUserId,
            store_id: storeId,
            ad_account_id: metaData.ad_account_id,
            account_name: "Ad Account",
            active: true,
          },
          { onConflict: "user_id,ad_account_id" }
        );
        accountsToSync = [
          { ad_account_id: metaData.ad_account_id, account_name: "Ad Account" },
        ];
      }
    }

    if (accountsToSync.length === 0) {
      return apiError(
        "no_ad_accounts",
        "No ad accounts found. Discover accounts in Settings after connecting Facebook.",
        404
      );
    }

    // 3. Determine sync range: first sync = maximum, incremental = last 7 days
    let isFirstSync = !!forceFullSync;

    if (!isFirstSync) {
      const { count } = await supabaseAdmin
        .from("ad_campaign_daily_insights")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId);

      isFirstSync = (count ?? 0) === 0;
    }

    // Build date range
    const now = new Date();
    const endStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    let startStr: string;
    if (isFirstSync) {
      // ~37 months back (Meta's maximum reporting window)
      const start = new Date(now);
      start.setMonth(start.getMonth() - 37);
      startStr = start.toISOString().split("T")[0];
    } else {
      // Last 7 days to capture attribution window updates
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      startStr = start.toISOString().split("T")[0];
    }

    // Meta API only supports time_increment=1 (daily breakdown) for ranges ≤ ~90 days.
    // For longer ranges (first sync), we chunk into 90-day windows.
    const CHUNK_DAYS = 90;
    const dateChunks: { since: string; until: string }[] = [];
    {
      const startMs = new Date(startStr).getTime();
      const endMs = new Date(endStr).getTime();
      let chunkStart = startMs;
      while (chunkStart < endMs) {
        const chunkEnd = Math.min(chunkStart + CHUNK_DAYS * 86_400_000, endMs);
        dateChunks.push({
          since: new Date(chunkStart).toISOString().split("T")[0],
          until: new Date(chunkEnd).toISOString().split("T")[0],
        });
        chunkStart = chunkEnd + 86_400_000; // next day after chunk end
      }
    }

    const nowIso = now.toISOString();
    let totalInsightRows = 0;
    let totalCampaignRows = 0;
    const errors: string[] = [];

    for (const account of accountsToSync) {
      const adAccountId = account.ad_account_id;

      try {
        // ── Phase A: Fetch campaign metadata (ACTIVE + PAUSED for display) ──
        const campaignsUrl =
          `${META_API}/${adAccountId}/campaigns` +
          `?fields=${CAMPAIGN_FIELDS}` +
          `&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]` +
          `&limit=500`;

        const campaignsResult = await fetchAllPages<MetaCampaign>(campaignsUrl, accessToken, `${account.account_name} campaigns`);
        if (campaignsResult.error) {
          errors.push(`${account.account_name}: campaigns fetch failed (${campaignsResult.error})`);
        }
        const campaigns = campaignsResult.data;

        if (campaigns.length > 0) {
          // Look up product_id mappings from ad_creator_campaigns
          const metaCampaignIds = campaigns.map((c) => c.id);
          const { data: creatorCampaigns } = await supabaseAdmin
            .from("ad_creator_campaigns")
            .select("meta_campaign_id, product_id")
            .eq("store_id", storeId)
            .in("meta_campaign_id", metaCampaignIds);

          const productIdMap = new Map<string, string>();
          if (creatorCampaigns) {
            for (const cc of creatorCampaigns) {
              if (cc.meta_campaign_id && cc.product_id) {
                productIdMap.set(cc.meta_campaign_id, cc.product_id);
              }
            }
          }

          // Upsert campaign metadata (no spend/metrics — those live in daily insights)
          const campaignRows = campaigns.map((campaign) => ({
            store_id: storeId,
            meta_campaign_id: campaign.id,
            ad_account_id: adAccountId,
            campaign_name: campaign.name,
            product: campaign.name,
            product_id: productIdMap.get(campaign.id) || null,
            budget: campaign.daily_budget
              ? parseFloat(campaign.daily_budget) / 100
              : 0,
            status: campaign.status === "PAUSED" ? "Paused" : "Active",
            last_synced_at: nowIso,
            updated_at: nowIso,
          }));

          const { error: campaignUpsertError } = await supabaseAdmin
            .from("ad_campaigns")
            .upsert(campaignRows, { onConflict: "store_id,meta_campaign_id" });

          if (campaignUpsertError) {
            errors.push(
              `${account.account_name}: campaign metadata upsert failed (${campaignUpsertError.message})`
            );
          } else {
            totalCampaignRows += campaignRows.length;
          }
        }

        // ── Phase B: Fetch daily insights for ALL campaigns (no status filter) ──
        // This captures spend from deleted/archived campaigns too.
        // Meta only supports time_increment=1 with ranges ≤ ~90 days,
        // so we iterate over dateChunks for the full range.
        for (const chunk of dateChunks) {
          const chunkTimeRange = JSON.stringify(chunk);
          const insightsUrl =
            `${META_API}/${adAccountId}/insights` +
            `?fields=${INSIGHT_FIELDS}` +
            `&level=campaign` +
            `&time_range=${encodeURIComponent(chunkTimeRange)}` +
            `&time_increment=1` +
            `&limit=500`;

          const insightsResult = await fetchAllPages<MetaDailyInsight>(
            insightsUrl,
            accessToken,
            `${account.account_name} insights ${chunk.since}→${chunk.until}`
          );
          if (insightsResult.error) {
            errors.push(`${account.account_name}: insights ${chunk.since}→${chunk.until} failed (${insightsResult.error})`);
            continue;
          }
          const dailyInsights = insightsResult.data;

          if (dailyInsights.length === 0) continue;

          // Build daily insight rows
          const insightRows = dailyInsights.map((insight) => {
            const spend = parseFloat(insight.spend || "0");
            const impressions = parseInt(insight.impressions || "0", 10);
            const clicks = parseInt(insight.clicks || "0", 10);
            const cpc = insight.cpc ? parseFloat(insight.cpc) : 0;
            const ctr = insight.ctr ? parseFloat(insight.ctr) : 0;
            const atc = Math.round(
              getActionValue(insight.actions, "add_to_cart")
            );
            const purchases = Math.round(
              getActionValue(insight.actions, "purchase")
            );
            const purchaseValue = getActionValue(
              insight.action_values,
              "purchase"
            );

            return {
              store_id: storeId,
              meta_campaign_id: insight.campaign_id,
              ad_account_id: adAccountId,
              date: insight.date_start,
              spend,
              impressions,
              clicks,
              cpc,
              ctr,
              atc,
              purchases,
              purchase_value: purchaseValue,
            };
          });

          // Upsert in batches of 500 to avoid payload limits
          const BATCH_SIZE = 500;
          for (let i = 0; i < insightRows.length; i += BATCH_SIZE) {
            const batch = insightRows.slice(i, i + BATCH_SIZE);
            const { error: insightUpsertError } = await supabaseAdmin
              .from("ad_campaign_daily_insights")
              .upsert(batch, {
                onConflict: "store_id,meta_campaign_id,date",
              });

            if (insightUpsertError) {
              errors.push(
                `${account.account_name}: upsert failed ${chunk.since}→${chunk.until} batch ${Math.floor(i / BATCH_SIZE) + 1} (${insightUpsertError.message})`
              );
            } else {
              totalInsightRows += batch.length;
            }
          }
        }
      } catch (err) {
        errors.push(
          `${account.account_name}: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }

    return NextResponse.json({
      synced: totalInsightRows,
      campaignsSynced: totalCampaignRows,
      insightRows: totalInsightRows,
      accountsSynced: accountsToSync.length,
      isFirstSync,
      dateRange: { start: startStr, end: endStr },
      lastSyncedAt: nowIso,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${totalCampaignRows} campaigns + ${totalInsightRows} daily insight rows from ${accountsToSync.length} account${accountsToSync.length !== 1 ? "s" : ""}`,
    });
  } catch (err) {
    console.error("Meta sync error:", err);
    return apiError(
      "server_error",
      "Internal server error during Meta sync",
      500,
      true
    );
  }
}
