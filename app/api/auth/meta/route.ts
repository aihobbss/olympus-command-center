import { NextResponse } from "next/server";

// Meta (Facebook) OAuth Step 1: Redirect to Facebook Login Dialog
// Requires: FACEBOOK_APP_ID in env
//
// Flow:
// 1. User clicks "Connect Meta Ads" → hits this route with ?userId=xxx
// 2. We redirect to Facebook OAuth consent screen (userId encoded in state)
// 3. Facebook redirects back to /api/auth/meta/callback with code + state
// 4. Callback decodes userId from state, exchanges code for token, saves to oauth_tokens

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const appId = process.env.FACEBOOK_APP_ID || process.env.META_APP_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

  if (!appId) {
    return NextResponse.json(
      {
        error: "META_NOT_CONFIGURED",
        message: "Meta app credentials are not configured. Add FACEBOOK_APP_ID to your environment variables.",
        setup_url: "https://developers.facebook.com/apps",
      },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "userId is required as a query parameter." },
      { status: 401 }
    );
  }

  // Encode userId + CSRF token into state (base64 JSON)
  const csrf = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ csrf, userId })).toString("base64url");

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
