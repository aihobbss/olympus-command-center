import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";

// Meta Graph API v19.0 — Campaign Insights sync
// Pulls campaign-level performance data from ALL active ad accounts
// and upserts into ad_campaigns table (tagged with ad_account_id)

const META_API = "https://graph.facebook.com/v19.0";

// Fields we request from Meta Ads Insights API
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

const CAMPAIGN_FIELDS = ["id", "name", "status", "daily_budget"].join(",");

type MetaInsight = {
  campaign_id: string;
  campaign_name: string;
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, datePreset } = body as {
      storeId: string;
      datePreset?: string;
    };

    if (!storeId) {
      return NextResponse.json(
        { error: "storeId is required" },
        { status: 400 }
      );
    }

    const authResult = await verifyApiUser(request, storeId);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const verifiedUserId = authResult.userId;

    // 1. Get user's Meta access token
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, expires_at, meta")
      .eq("user_id", verifiedUserId)
      .eq("service", "facebook")
      .single();

    if (tokenError || !tokenRow?.access_token) {
      return NextResponse.json(
        { error: "Meta not connected. Please connect your Facebook account in Settings." },
        { status: 401 }
      );
    }

    // Check token expiry
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Meta token expired. Please reconnect Facebook in Settings." },
        { status: 401 }
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

    // Fallback: if no accounts in new table, check legacy oauth_tokens.meta
    if (accountsToSync.length === 0) {
      const metaData = (tokenRow.meta as Record<string, string>) || {};
      if (metaData.ad_account_id) {
        // Migrate legacy account to new table
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
      return NextResponse.json(
        { error: "No ad accounts found. Discover accounts in Settings after connecting Facebook." },
        { status: 404 }
      );
    }

    // 3. Sync campaigns from all active accounts
    const preset = datePreset || "last_7d";
    const now = new Date().toISOString();
    let totalSynced = 0;
    const errors: string[] = [];

    for (const account of accountsToSync) {
      const adAccountId = account.ad_account_id;

      try {
        // Fetch campaigns list for this account
        const campaignsRes = await fetch(
          `${META_API}/${adAccountId}/campaigns?fields=${CAMPAIGN_FIELDS}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&limit=100`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!campaignsRes.ok) {
          const err = await campaignsRes.json().catch(() => ({}));
          errors.push(
            `${account.account_name}: campaigns fetch failed (${err?.error?.message || "unknown"})`
          );
          continue;
        }

        const campaignsData = await campaignsRes.json();
        const campaigns = (campaignsData.data || []) as MetaCampaign[];

        if (campaigns.length === 0) continue;

        // Fetch insights for all campaigns in this account
        const insightsRes = await fetch(
          `${META_API}/${adAccountId}/insights?fields=${INSIGHT_FIELDS}&level=campaign&date_preset=${preset}&limit=500`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        let insights: MetaInsight[] = [];
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json();
          insights = (insightsData.data || []) as MetaInsight[];
        }

        // Index insights by campaign_id
        const insightMap = new Map<string, MetaInsight>();
        for (const insight of insights) {
          insightMap.set(insight.campaign_id, insight);
        }

        // Build upsert rows
        const rows = campaigns.map((campaign) => {
          const insight = insightMap.get(campaign.id);
          const spend = insight ? parseFloat(insight.spend) : 0;
          const cpc = insight?.cpc ? parseFloat(insight.cpc) : 0;
          const ctr = insight?.ctr ? parseFloat(insight.ctr) : 0;

          const purchases = getActionValue(insight?.actions, "purchase");
          const addToCart = getActionValue(insight?.actions, "add_to_cart");
          const purchaseValue = getActionValue(
            insight?.action_values,
            "purchase"
          );

          const revenue = purchaseValue;
          const orders = Math.round(purchases);
          const roas =
            spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;
          const budget = campaign.daily_budget
            ? parseFloat(campaign.daily_budget) / 100
            : 0;

          return {
            store_id: storeId,
            meta_campaign_id: campaign.id,
            ad_account_id: adAccountId,
            campaign_name: campaign.name,
            product: campaign.name,
            spend,
            budget,
            cpc,
            ctr,
            atc: Math.round(addToCart),
            roas,
            revenue,
            orders,
            profit: revenue - spend,
            status: campaign.status === "PAUSED" ? "Paused" : "Active",
            recommendation: null,
            recommendation_reason: null,
            last_synced_at: now,
            updated_at: now,
          };
        });

        // Upsert into ad_campaigns
        const { error: upsertError } = await supabaseAdmin
          .from("ad_campaigns")
          .upsert(rows, { onConflict: "store_id,meta_campaign_id" });

        if (upsertError) {
          errors.push(
            `${account.account_name}: upsert failed (${upsertError.message})`
          );
        } else {
          totalSynced += rows.length;
        }
      } catch (err) {
        errors.push(
          `${account.account_name}: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }

    return NextResponse.json({
      synced: totalSynced,
      accountsSynced: accountsToSync.length,
      lastSyncedAt: now,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${totalSynced} campaigns from ${accountsToSync.length} account${accountsToSync.length !== 1 ? "s" : ""}`,
    });
  } catch (err) {
    console.error("Meta sync error:", err);
    return NextResponse.json(
      { error: "Internal server error during Meta sync" },
      { status: 500 }
    );
  }
}
