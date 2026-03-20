import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

// Meta Graph API v19.0 — Campaign Actions (Kill / Scale / Pass)
// Kill: pauses campaign | Scale: updates daily budget | Pass: logs decision only

const META_API = "https://graph.facebook.com/v19.0";

type ActionType = "kill" | "scale" | "pass";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, campaignId, action, newBudget } = body as {
      userId: string;
      campaignId: string; // Our internal ad_campaigns.id
      action: ActionType;
      newBudget?: number; // Required for "scale" — daily budget in dollars
    };

    if (!userId || !campaignId || !action) {
      return apiError("missing_fields", "userId, campaignId, and action are required", 400);
    }

    // Verify caller identity
    const authResult = await verifyApiUser(request);
    if ("error" in authResult) {
      return apiError("auth_failed", authResult.error, authResult.status);
    }
    const verifiedUserId = authResult.userId;

    if (action === "scale" && (!newBudget || newBudget <= 0)) {
      return apiError("invalid_budget", "newBudget is required for scale action and must be positive", 400);
    }

    // 1. Get campaign details (need meta_campaign_id)
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("ad_campaigns")
      .select("id, meta_campaign_id, campaign_name, budget, budget_history, store_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return apiError("campaign_not_found", "Campaign not found", 404);
    }

    // Verify the user has access to this campaign's store
    const { data: storeMembership } = await supabaseAdmin
      .from("user_stores")
      .select("store_id")
      .eq("user_id", verifiedUserId)
      .eq("store_id", campaign.store_id)
      .single();
    if (!storeMembership) {
      return apiError("campaign_not_found", "Campaign not found", 404);
    }

    if (!campaign.meta_campaign_id) {
      return apiError("no_meta_campaign_id", "Campaign has no Meta campaign ID — cannot perform action", 400);
    }

    // 2. Get user's Meta access token
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, expires_at")
      .eq("user_id", verifiedUserId)
      .eq("service", "facebook")
      .single();

    if (tokenError || !tokenRow?.access_token) {
      return apiError("meta_not_connected", "Meta not connected", 401);
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return apiError("meta_token_expired", "Meta token expired. Please reconnect.", 401);
    }

    const accessToken = tokenRow.access_token;
    const metaCampaignId = campaign.meta_campaign_id;
    const now = new Date().toISOString();

    // 3. Execute action on Meta API
    if (action === "kill") {
      // Pause the campaign
      const res = await fetch(`${META_API}/${metaCampaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: "PAUSED",
        }),
      });

      if (!res.ok) {
        await res.json().catch(() => ({}));
        return apiError("meta_pause_failed", "Failed to pause campaign on Meta", 502, true);
      }

      // Update local DB
      await supabaseAdmin
        .from("ad_campaigns")
        .update({
          status: "Killed",
          recommendation: "Killed",
          recommendation_reason: "Manually killed by user",
          updated_at: now,
        })
        .eq("id", campaignId);

      return NextResponse.json({
        success: true,
        action: "kill",
        campaignName: campaign.campaign_name,
        message: `Campaign "${campaign.campaign_name}" paused on Meta`,
      });
    }

    if (action === "scale") {
      // Update daily budget (Meta expects budget in cents)
      const budgetCents = Math.round(newBudget! * 100);

      const res = await fetch(`${META_API}/${metaCampaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          daily_budget: budgetCents,
        }),
      });

      if (!res.ok) {
        await res.json().catch(() => ({}));
        return apiError("meta_budget_update_failed", "Failed to update budget on Meta", 502, true);
      }

      // Append to budget history
      const history = Array.isArray(campaign.budget_history)
        ? campaign.budget_history
        : [];
      history.push({
        date: now,
        previousBudget: campaign.budget,
        newBudget: newBudget,
        action: "scale",
      });

      // Update local DB
      await supabaseAdmin
        .from("ad_campaigns")
        .update({
          budget: newBudget,
          status: "Scaling",
          recommendation: "Scaling",
          recommendation_reason: `Budget scaled from $${campaign.budget} to $${newBudget}`,
          budget_history: history,
          updated_at: now,
        })
        .eq("id", campaignId);

      return NextResponse.json({
        success: true,
        action: "scale",
        campaignName: campaign.campaign_name,
        previousBudget: campaign.budget,
        newBudget,
        message: `Campaign "${campaign.campaign_name}" budget updated to $${newBudget}/day`,
      });
    }

    if (action === "pass") {
      // Log the decision locally — no Meta API call
      const history = Array.isArray(campaign.budget_history)
        ? campaign.budget_history
        : [];
      history.push({
        date: now,
        action: "pass",
        note: "User reviewed and passed",
      });

      await supabaseAdmin
        .from("ad_campaigns")
        .update({
          recommendation: "Watch",
          recommendation_reason: "Manually passed — continue monitoring",
          budget_history: history,
          updated_at: now,
        })
        .eq("id", campaignId);

      return NextResponse.json({
        success: true,
        action: "pass",
        campaignName: campaign.campaign_name,
        message: `Campaign "${campaign.campaign_name}" marked as passed`,
      });
    }

    return apiError("unknown_action", `Unknown action: ${action}. Use kill, scale, or pass.`, 400);
  } catch (err) {
    console.error("Meta campaign action error:", err);
    return apiError("server_error", "Internal server error", 500, true);
  }
}
