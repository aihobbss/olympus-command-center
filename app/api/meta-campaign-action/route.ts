import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

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
      return NextResponse.json(
        { error: "userId, campaignId, and action are required" },
        { status: 400 }
      );
    }

    if (action === "scale" && (!newBudget || newBudget <= 0)) {
      return NextResponse.json(
        { error: "newBudget is required for scale action and must be positive" },
        { status: 400 }
      );
    }

    // 1. Get campaign details (need meta_campaign_id)
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("ad_campaigns")
      .select("id, meta_campaign_id, campaign_name, budget, budget_history, store_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (!campaign.meta_campaign_id) {
      return NextResponse.json(
        { error: "Campaign has no Meta campaign ID — cannot perform action" },
        { status: 400 }
      );
    }

    // 2. Get user's Meta access token
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, expires_at")
      .eq("user_id", userId)
      .eq("service", "facebook")
      .single();

    if (tokenError || !tokenRow?.access_token) {
      return NextResponse.json(
        { error: "Meta not connected" },
        { status: 401 }
      );
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Meta token expired. Please reconnect." },
        { status: 401 }
      );
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
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: "Failed to pause campaign on Meta", details: err },
          { status: 502 }
        );
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
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: "Failed to update budget on Meta", details: err },
          { status: 502 }
        );
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

    return NextResponse.json(
      { error: `Unknown action: ${action}. Use kill, scale, or pass.` },
      { status: 400 }
    );
  } catch (err) {
    console.error("Meta campaign action error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
