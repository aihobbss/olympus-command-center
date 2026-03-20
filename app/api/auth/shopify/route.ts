import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

// Shopify Dev Dashboard custom app connection
// Uses client_credentials grant (no OAuth redirect needed).
// User provides their .myshopify.com domain, we exchange client_id/secret for a token.
// Tokens expire after 24h — auto-refreshed by getShopifyToken() helper.

export async function GET() {
  return apiError("use_post", "POST { storeDomain } to connect.", 400);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const storeDomain = body.storeDomain as string;

  // Authenticate via JWT — never trust body-supplied userId
  const auth = await verifyApiUser(request);
  if ("error" in auth) {
    return apiError("unauthorized", auth.error, auth.status);
  }
  const userId = auth.userId;

  if (!storeDomain || !storeDomain.endsWith(".myshopify.com")) {
    return apiError("invalid_domain", "Provide a valid .myshopify.com domain.", 400);
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return apiError("shopify_not_configured", "Shopify app credentials not configured.", 503, true);
  }

  // Look up user's active store
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, active_store_id")
    .eq("id", userId)
    .single();

  if (!profile) {
    return apiError("unauthorized", "Invalid user.", 401);
  }

  const storeId = profile.active_store_id;
  if (!storeId) {
    return apiError("no_store", "Create a store first.", 400);
  }

  // Client credentials grant — form-encoded, NOT JSON
  console.log("Shopify connect attempt:", { storeDomain, hasClientId: !!clientId, hasClientSecret: !!clientSecret });
  try {
    const tokenRes = await fetch(
      `https://${storeDomain}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      }
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => "");
      console.error("Shopify client_credentials failed:", tokenRes.status, errBody);
      return apiError("token_failed", `Shopify returned ${tokenRes.status}: ${errBody.slice(0, 200)}`, 400);
    }

    const tokenData = await tokenRes.json();
    // tokenData: { access_token, scope, expires_in (86399 = 24h) }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Save token + credentials for auto-refresh
    const { error: upsertError } = await supabaseAdmin
      .from("oauth_tokens")
      .upsert(
        {
          user_id: userId,
          service: "shopify",
          store_id: storeId,
          access_token: tokenData.access_token,
          client_id: clientId,
          client_secret: clientSecret,
          scopes: tokenData.scope || "read_products,write_products,read_orders",
          expires_at: expiresAt,
          meta: { shopify_domain: storeDomain },
        },
        { onConflict: "store_id,service" }
      );

    if (upsertError) {
      console.error("Failed to save Shopify token:", upsertError.message);
      return apiError("save_failed", "Failed to save connection.", 500, true);
    }

    // Update store's shopify_domain
    await supabaseAdmin
      .from("stores")
      .update({ shopify_domain: storeDomain })
      .eq("id", storeId);

    return NextResponse.json({ success: true, message: "Shopify connected." });
  } catch (err) {
    console.error("Shopify connection error:", err);
    return apiError("connection_failed", "Could not reach Shopify. Check your store domain.", 502, true);
  }
}
