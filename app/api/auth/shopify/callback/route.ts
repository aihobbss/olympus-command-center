import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Shopify OAuth Step 2: Handle callback with authorization code
// Exchanges code for permanent access token and saves to oauth_tokens

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const stateParam = searchParams.get("state");

  if (!code || !shop || !stateParam) {
    return NextResponse.redirect(
      new URL("/settings?error=shopify_missing_params", request.url)
    );
  }

  // Decode userId and shop from state
  let userId: string | null = null;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect(
      new URL("/settings?error=shopify_invalid_state", request.url)
    );
  }

  if (!userId) {
    return NextResponse.redirect(
      new URL("/settings?error=shopify_missing_user", request.url)
    );
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/settings?error=shopify_not_configured", request.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const tokenBody = { client_id: clientId, client_secret: clientSecret, code };
    console.log("Shopify token exchange:", { url: tokenUrl, shop, codeLength: code.length, clientId: clientId.slice(0, 8) + "..." });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text().catch(() => "no body");
      console.error("Shopify token exchange failed:", tokenResponse.status, tokenResponse.statusText, errBody);
      return NextResponse.redirect(
        new URL(`/settings?error=shopify_token_exchange_failed&detail=${encodeURIComponent(tokenResponse.status + ": " + errBody.slice(0, 200))}`, request.url)
      );
    }

    const tokenData = await tokenResponse.json();

    // Look up the user's active store to get store_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_store_id")
      .eq("id", userId)
      .single();

    const storeId = profile?.active_store_id;
    if (!storeId) {
      return NextResponse.redirect(
        new URL("/settings?error=shopify_no_store", request.url)
      );
    }

    // Store token in oauth_tokens (Shopify offline tokens don't expire)
    const { error: upsertError } = await supabaseAdmin
      .from("oauth_tokens")
      .upsert(
        {
          user_id: userId,
          service: "shopify",
          store_id: storeId,
          access_token: tokenData.access_token,
          scopes: tokenData.scope || "read_products,write_products,read_orders",
          expires_at: null,
          meta: { shopify_domain: shop },
        },
        { onConflict: "store_id,service" }
      );

    if (upsertError) {
      console.error("Failed to save Shopify token:", upsertError.message);
      return NextResponse.redirect(
        new URL("/settings?error=shopify_save_failed", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/settings?connected=shopify", request.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/settings?error=shopify_callback_error", request.url)
    );
  }
}
