import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";

// Push an Ad Creator campaign to Meta as a real Facebook campaign
// Creates: Campaign → Ad Set → Ad (with creative)
// Requires: ads_management permission + connected Meta account

const META_API = "https://graph.facebook.com/v19.0";

// Map our country codes to Meta geo-targeting location keys
const COUNTRY_MAP: Record<string, string[]> = {
  UK: ["GB"],
  AU: ["AU"],
  US: ["US"],
  CA: ["CA"],
  EU: ["GB", "DE", "FR", "IT", "ES", "NL", "BE", "SE", "DK", "NO", "FI"],
  "": ["GB"], // Default
};

// Map CTA strings to Meta CTA enum values
const CTA_MAP: Record<string, string> = {
  "Shop Now": "SHOP_NOW",
  "Learn More": "LEARN_MORE",
  "Sign Up": "SIGN_UP",
  "Order Now": "ORDER_NOW",
  "Buy Now": "BUY_NOW",
  "Get Offer": "GET_OFFER",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, campaignId, adAccountId: selectedAdAccountId } = body as {
      userId: string;
      campaignId: string; // ad_creator_campaigns.id
      adAccountId?: string; // Optional: specific ad account to publish to
    };

    if (!userId || !campaignId) {
      return NextResponse.json(
        { error: "userId and campaignId are required" },
        { status: 400 }
      );
    }

    // 1. Get campaign details from ad_creator_campaigns (include product_id)
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("ad_creator_campaigns")
      .select("*, product_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const authResult = await verifyApiUser(request, campaign.store_id);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const verifiedUserId = authResult.userId;

    // 2. Get Meta token + ad account ID
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, expires_at, meta")
      .eq("user_id", verifiedUserId)
      .eq("service", "facebook")
      .single();

    if (tokenError || !tokenRow?.access_token) {
      return NextResponse.json(
        { error: "Meta not connected. Connect Facebook in Settings." },
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

    // Resolve ad account: use selected account, or fall back to first active account
    let adAccountId = selectedAdAccountId;

    if (!adAccountId) {
      // Try user_ad_accounts table first
      const { data: adAccounts } = await supabaseAdmin
        .from("user_ad_accounts")
        .select("ad_account_id")
        .eq("user_id", verifiedUserId)
        .eq("active", true)
        .limit(1);

      if (adAccounts && adAccounts.length > 0) {
        adAccountId = adAccounts[0].ad_account_id;
      } else {
        // Fallback to legacy oauth_tokens.meta
        const metaData = (tokenRow.meta as Record<string, string>) || {};
        adAccountId = metaData.ad_account_id;
      }
    }

    if (!adAccountId) {
      return NextResponse.json(
        { error: "No ad account found. Discover accounts in Settings after connecting Facebook." },
        { status: 400 }
      );
    }

    // 3. Get a Facebook Page ID (needed for ads)
    const pagesRes = await fetch(
      `${META_API}/me/accounts?fields=id,name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const pagesData = await pagesRes.json();
    const pageId = pagesData.data?.[0]?.id;

    if (!pageId) {
      return NextResponse.json(
        { error: "No Facebook Page found. You need at least one Facebook Page to create ads." },
        { status: 400 }
      );
    }

    // 4. Create Campaign on Meta
    const countries = COUNTRY_MAP[campaign.country ?? ""] || ["GB"];
    const budgetCents = Math.round((campaign.daily_budget || 30) * 100);

    const campaignRes = await fetch(`${META_API}/${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: campaign.product_name || "Vantage Campaign",
        objective: "OUTCOME_SALES",
        status: "PAUSED", // Start paused so user can review
        special_ad_categories: [],
      }),
    });

    if (!campaignRes.ok) {
      const err = await campaignRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Failed to create campaign on Meta", details: err },
        { status: 502 }
      );
    }

    const { id: metaCampaignId } = await campaignRes.json();

    // 5. Create Ad Set
    const targeting: Record<string, unknown> = {
      geo_locations: { countries },
    };

    if (campaign.gender === "Male") {
      targeting.genders = [1];
    } else if (campaign.gender === "Female") {
      targeting.genders = [2];
    }
    // "All" = no gender filter

    const adSetRes = await fetch(`${META_API}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: `${campaign.product_name || "Campaign"} - Ad Set`,
        campaign_id: metaCampaignId,
        daily_budget: budgetCents,
        billing_event: "IMPRESSIONS",
        optimization_goal: "OFFSITE_CONVERSIONS",
        targeting,
        status: "PAUSED",
      }),
    });

    if (!adSetRes.ok) {
      const err = await adSetRes.json().catch(() => ({}));
      // Clean up: delete the campaign we just created
      await fetch(`${META_API}/${metaCampaignId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      }).catch((cleanupErr) => console.error("Failed to clean up Meta campaign:", cleanupErr));
      return NextResponse.json(
        { error: "Failed to create ad set on Meta", details: err },
        { status: 502 }
      );
    }

    const { id: adSetId } = await adSetRes.json();

    // 6. Create Ad Creative
    const ctaType = CTA_MAP[campaign.cta || "Shop Now"] || "SHOP_NOW";

    const creativeRes = await fetch(`${META_API}/${adAccountId}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: `${campaign.product_name || "Creative"} - Creative`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            link: campaign.product_url || "https://example.com",
            message: campaign.primary_text || "",
            name: campaign.headline || campaign.product_name || "",
            description: campaign.description || "",
            call_to_action: { type: ctaType },
          },
        },
      }),
    });

    if (!creativeRes.ok) {
      const err = await creativeRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Failed to create ad creative on Meta", details: err },
        { status: 502 }
      );
    }

    const { id: creativeId } = await creativeRes.json();

    // 7. Create Ad (links ad set + creative)
    const adRes = await fetch(`${META_API}/${adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: `${campaign.product_name || "Ad"} - Ad`,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: "PAUSED",
      }),
    });

    if (!adRes.ok) {
      const err = await adRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Failed to create ad on Meta", details: err },
        { status: 502 }
      );
    }

    // 8. Update our DB: mark campaign as Live + store Meta campaign ID + ad account
    await supabaseAdmin
      .from("ad_creator_campaigns")
      .update({
        status: "Live",
        meta_campaign_id: metaCampaignId,
        ad_account_id: adAccountId,
      })
      .eq("id", campaignId);

    // Also insert into ad_campaigns for tracking (propagate product_id)
    await supabaseAdmin
      .from("ad_campaigns")
      .upsert({
        store_id: campaign.store_id,
        meta_campaign_id: metaCampaignId,
        ad_account_id: adAccountId,
        campaign_name: campaign.product_name || "Vantage Campaign",
        product: campaign.product_name,
        product_id: campaign.product_id || null,
        budget: campaign.daily_budget || 30,
        status: "Paused", // Starts paused on Meta
        spend: 0,
        cpc: 0,
        ctr: 0,
        atc: 0,
        roas: 0,
        revenue: 0,
        orders: 0,
        profit: 0,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id,meta_campaign_id" });

    return NextResponse.json({
      success: true,
      metaCampaignId,
      adSetId,
      creativeId,
      message: `Campaign "${campaign.product_name}" created on Meta (starts PAUSED — enable in Meta Ads Manager or via Ad Manager)`,
    });
  } catch (err) {
    console.error("Push to Meta error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
