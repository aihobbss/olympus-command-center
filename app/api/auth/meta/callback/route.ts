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

  // Decode userId + storeId from state
  let userId: string | null = null;
  let storeId: string | null = null;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    userId = decoded.userId;
    storeId = decoded.storeId || null;
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

    // Store token in oauth_tokens (store-scoped when storeId is available)
    const finalToken = longLived.access_token || access_token;
    const tokenPayload: Record<string, unknown> = {
      user_id: userId,
      service: "facebook",
      access_token: finalToken,
      expires_at: expiresAt,
    };
    if (storeId) tokenPayload.store_id = storeId;

    const { error: upsertError } = await supabaseAdmin
      .from("oauth_tokens")
      .upsert(
        tokenPayload,
        { onConflict: storeId ? "store_id,service" : "user_id,service" }
      );

    if (upsertError) {
      console.error("Failed to save Meta token:", upsertError.message);
      return NextResponse.redirect(
        new URL("/settings?error=meta_save_failed", request.url)
      );
    }

    // Auto-discover ad accounts after successful OAuth
    try {
      // Use storeId from OAuth state, fall back to user's active_store_id
      let discoverStoreId = storeId;
      if (!discoverStoreId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("active_store_id")
          .eq("id", userId)
          .single();
        discoverStoreId = profile?.active_store_id || null;
      }

      if (discoverStoreId) {
        const meRes = await fetch(
          `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency,business_name&limit=100`,
          { headers: { Authorization: `Bearer ${finalToken}` } }
        );

        if (meRes.ok) {
          const meData = await meRes.json();
          const accounts = meData.data || [];

          if (accounts.length > 0) {
            const rows = accounts.map((acct: { id: string; name?: string; account_status?: number; business_name?: string }) => ({
              user_id: userId,
              store_id: discoverStoreId,
              ad_account_id: acct.id,
              account_name: acct.name || acct.business_name || acct.id,
              account_status: acct.account_status ?? 1,
              active: true,
            }));

            await supabaseAdmin
              .from("user_ad_accounts")
              .upsert(rows, { onConflict: "user_id,ad_account_id" });
          }
        }
      }
    } catch (discoverErr) {
      // Non-fatal: ad accounts can be discovered later via Settings
      console.error("Auto-discover ad accounts failed (non-fatal):", discoverErr);
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
