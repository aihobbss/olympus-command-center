import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

// Meta (Facebook) OAuth Step 1: Redirect to Facebook Login Dialog
// Requires: FACEBOOK_APP_ID in env
//
// Flow:
// 1. User clicks "Connect Meta Ads" → hits this route with ?userId=xxx&storeId=xxx
// 2. We verify the user's JWT and store access, then redirect to Facebook OAuth
// 3. Facebook redirects back to /api/auth/meta/callback with code + state
// 4. Callback decodes userId from state, validates CSRF, exchanges code for token

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  const appId = process.env.FACEBOOK_APP_ID || process.env.META_APP_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

  if (!appId) {
    return apiError("meta_not_configured", "Meta app credentials are not configured.", 503, true);
  }

  if (!storeId) {
    return apiError("missing_store", "storeId is required as a query parameter.", 400);
  }

  // Verify the authenticated user owns/has access to this store
  const auth = await verifyApiUser(request, storeId);
  if ("error" in auth) {
    return apiError("unauthorized", auth.error, auth.status);
  }
  const userId = auth.userId;

  // Encode userId + storeId + CSRF token into state (base64 JSON)
  const csrf = crypto.randomUUID();
  const statePayload: Record<string, string> = { csrf, userId };
  if (storeId) statePayload.storeId = storeId;
  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  // Store CSRF token in Supabase for validation in callback (10-minute TTL via DB default)
  const csrfPayload: Record<string, string> = {
    csrf_token: csrf,
    user_id: userId,
    service: "facebook",
    store_id: storeId,
  };

  const { error: csrfError } = await supabaseAdmin
    .from("oauth_csrf_tokens")
    .insert(csrfPayload);

  if (csrfError) {
    console.error("Failed to store CSRF token:", csrfError.message);
    return NextResponse.json(
      { error: "CSRF_STORE_FAILED", message: "Failed to initialize OAuth flow." },
      { status: 500 }
    );
  }

  // Request permissions for ads management
  const permissions = [
    "ads_management",
    "ads_read",
    "business_management",
    "pages_read_engagement",
  ].join(",");

  const authUrl =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${permissions}` +
    `&state=${state}` +
    `&response_type=code`;

  return NextResponse.redirect(authUrl);
}
