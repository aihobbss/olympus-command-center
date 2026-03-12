import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Meta Graph API v19.0 — Campaign Insights sync
// Pulls campaign-level performance data and upserts into ad_campaigns table

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
    const { userId, storeId, datePreset } = body as {
      userId: string;
      storeId: string;
      datePreset?: string;
    };

    if (!userId || !storeId) {
      return NextResponse.json(
        { error: "userId and storeId are required" },
        { status: 400 }
      );
    }

    // 1. Get user's Meta access token
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, expires_at, meta")
      .eq("user_id", userId)
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
    const metaData = (tokenRow.meta as Record<string, string>) || {};
    let adAccountId = metaData.ad_account_id;

    // 2. If no ad account ID stored, fetch it from Meta
    if (!adAccountId) {
      const meRes = await fetch(
        `${META_API}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
      );

      if (!meRes.ok) {
        const err = await meRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: "Failed to fetch ad accounts from Meta", details: err },
          { status: 502 }
        );
      }

      const meData = await meRes.json();
      const accounts = meData.data as { id: string; name: string; account_status: number }[];

      if (!accounts || accounts.length === 0) {
        return NextResponse.json(
          { error: "No ad accounts found on this Facebook account" },
          { status: 404 }
        );
      }

      // Use first active account (account_status 1 = ACTIVE)
      const active = accounts.find((a) => a.account_status === 1) || accounts[0];
      adAccountId = active.id;

      // Store ad account ID for future syncs
      await supabaseAdmin
        .from("oauth_tokens")
        .update({ meta: { ...metaData, ad_account_id: adAccountId } })
        .eq("user_id", userId)
        .eq("service", "facebook");
    }

    // 3. Fetch campaigns list
    const campaignsRes = await fetch(
      `${META_API}/${adAccountId}/campaigns?fields=${CAMPAIGN_FIELDS}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&limit=100&access_token=${accessToken}`
    );

    if (!campaignsRes.ok) {
      const err = await campaignsRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Failed to fetch campaigns from Meta", details: err },
        { status: 502 }
      );
    }

    const campaignsData = await campaignsRes.json();
    const campaigns = (campaignsData.data || []) as MetaCampaign[];

    if (campaigns.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: "No active or paused campaigns found",
      });
    }

    // 4. Fetch insights for all campaigns (date range)
    const preset = datePreset || "last_7d";
    const insightsRes = await fetch(
      `${META_API}/${adAccountId}/insights?fields=${INSIGHT_FIELDS}&level=campaign&date_preset=${preset}&limit=500&access_token=${accessToken}`
    );

    if (!insightsRes.ok) {
      const err = await insightsRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Failed to fetch campaign insights from Meta", details: err },
        { status: 502 }
      );
    }

    const insightsData = await insightsRes.json();
    const insights = (insightsData.data || []) as MetaInsight[];

    // Index insights by campaign_id
    const insightMap = new Map<string, MetaInsight>();
    for (const insight of insights) {
      insightMap.set(insight.campaign_id, insight);
    }

    // 5. Build upsert rows
    const now = new Date().toISOString();
    const rows = campaigns.map((campaign) => {
      const insight = insightMap.get(campaign.id);
      const spend = insight ? parseFloat(insight.spend) : 0;
      const cpc = insight?.cpc ? parseFloat(insight.cpc) : 0;
      const ctr = insight?.ctr ? parseFloat(insight.ctr) : 0;

      // Extract purchase-related actions
      const purchases = getActionValue(insight?.actions, "purchase");
      const addToCart = getActionValue(insight?.actions, "add_to_cart");
      const purchaseValue = getActionValue(insight?.action_values, "purchase");

      const revenue = purchaseValue;
      const orders = Math.round(purchases);
      const roas = spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;
      const budget = campaign.daily_budget
        ? parseFloat(campaign.daily_budget) / 100 // Meta returns in cents
        : 0;

      return {
        store_id: storeId,
        meta_campaign_id: campaign.id,
        campaign_name: campaign.name,
        product: campaign.name, // Default to campaign name; user can override
        spend,
        budget,
        cpc,
        ctr,
        atc: Math.round(addToCart),
        roas,
        revenue,
        orders,
        profit: revenue - spend, // Simplified; real P&L calculated in Profit Tracker
        status: campaign.status === "PAUSED" ? "Paused" : "Active",
        recommendation: null,
        recommendation_reason: null,
        last_synced_at: now,
        updated_at: now,
      };
    });

    // 6. Upsert into ad_campaigns (match on meta_campaign_id)
    const { error: upsertError } = await supabaseAdmin
      .from("ad_campaigns")
      .upsert(rows, { onConflict: "store_id,meta_campaign_id" });

    if (upsertError) {
      console.error("Failed to upsert campaigns:", upsertError.message);
      return NextResponse.json(
        { error: "Failed to save campaign data", details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      synced: rows.length,
      adAccountId,
      lastSyncedAt: now,
      message: `Successfully synced ${rows.length} campaigns`,
    });
  } catch (err) {
    console.error("Meta sync error:", err);
    return NextResponse.json(
      { error: "Internal server error during Meta sync" },
      { status: 500 }
    );
  }
}
