import { supabaseAdmin } from "@/lib/supabase-server";

// Get a valid Shopify access token for a user, auto-refreshing if expired.
// Dev Dashboard custom apps use client_credentials grant with 24h expiry.

export async function getShopifyToken(
  userId: string,
  storeId?: string
): Promise<{ accessToken: string; shopifyDomain: string } | null> {
  let query = supabaseAdmin
    .from("oauth_tokens")
    .select("access_token, client_id, client_secret, expires_at, meta")
    .eq("user_id", userId)
    .eq("service", "shopify");

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { data: row } = await query.single();

  if (!row?.access_token) return null;

  const meta = (row.meta as Record<string, string>) || {};
  const shopifyDomain = meta.shopify_domain;
  if (!shopifyDomain) return null;

  // Check if token is still valid (with 5-min buffer)
  const isExpired =
    row.expires_at &&
    new Date(row.expires_at).getTime() - 5 * 60 * 1000 < Date.now();

  if (!isExpired) {
    return { accessToken: row.access_token, shopifyDomain };
  }

  // Token expired — refresh using client credentials
  const clientId = row.client_id || process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = row.client_secret || process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Cannot refresh Shopify token: missing client credentials");
    return null;
  }

  try {
    const tokenRes = await fetch(
      `https://${shopifyDomain}/admin/oauth/access_token`,
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
      console.error("Shopify token refresh failed:", tokenRes.status);
      return null;
    }

    const tokenData = await tokenRes.json();
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Update stored token
    let updateQuery = supabaseAdmin
      .from("oauth_tokens")
      .update({
        access_token: tokenData.access_token,
        expires_at: expiresAt,
      })
      .eq("user_id", userId)
      .eq("service", "shopify");

    if (storeId) {
      updateQuery = updateQuery.eq("store_id", storeId);
    }

    await updateQuery;

    return { accessToken: tokenData.access_token, shopifyDomain };
  } catch (err) {
    console.error("Shopify token refresh error:", err);
    return null;
  }
}
