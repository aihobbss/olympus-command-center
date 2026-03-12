import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Meta OAuth Step 2: Handle callback with authorization code
// Exchanges code for access token and saves to oauth_tokens

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=meta_${error}`, request.url)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/settings?error=meta_missing_params", request.url)
    );
  }

  // Decode userId from state
  let userId: string | null = null;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect(
      new URL("/settings?error=meta_invalid_state", request.url)
    );
  }

  if (!userId) {
    return NextResponse.redirect(
      new URL("/settings?error=meta_missing_user", request.url)
    );
  }

  const appId = process.env.FACEBOOK_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.META_APP_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL("/settings?error=meta_not_configured", request.url)
    );
  }

  try {
    // Exchange code for short-lived token
    const tokenUrl =
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL("/settings?error=meta_token_exchange_failed", request.url)
      );
    }

    const { access_token, expires_in } = await tokenResponse.json();

    // Exchange for long-lived token (60 days)
    const longLivedUrl =
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${access_token}`;

    const longLivedResponse = await fetch(longLivedUrl);
    const longLived = longLivedResponse.ok
      ? await longLivedResponse.json()
      : { access_token, expires_in };

    // Calculate expiry
    const expiresAt = new Date(
      Date.now() + (longLived.expires_in || expires_in || 5184000) * 1000
    ).toISOString();

    // Store token in oauth_tokens
    const { error: upsertError } = await supabaseAdmin
      .from("oauth_tokens")
      .upsert(
        {
          user_id: userId,
          service: "facebook",
          access_token: longLived.access_token || access_token,
          expires_at: expiresAt,
        },
        { onConflict: "user_id,service" }
      );

    if (upsertError) {
      console.error("Failed to save Meta token:", upsertError.message);
      return NextResponse.redirect(
        new URL("/settings?error=meta_save_failed", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/settings?connected=facebook", request.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/settings?error=meta_callback_error", request.url)
    );
  }
}
