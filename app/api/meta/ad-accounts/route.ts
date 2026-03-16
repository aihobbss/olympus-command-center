import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";

// Meta Ad Accounts — discover and manage multiple ad accounts per user
// GET: list user's saved ad accounts
// POST: discover ad accounts from Meta API and save them

const META_API = "https://graph.facebook.com/v19.0";

// ── GET: List saved ad accounts ──────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  const authResult = await verifyApiUser(request);
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  // Use verified userId instead of query param
  const verifiedUserId = authResult.userId;

  const query = supabaseAdmin
    .from("user_ad_accounts")
    .select("id, user_id, store_id, ad_account_id, account_name, account_status, active, created_at")
    .eq("user_id", verifiedUserId)
    .order("created_at", { ascending: true });

  if (storeId) {
    query.eq("store_id", storeId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch ad accounts", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ accounts: data || [] });
}

// ── POST: Discover ad accounts from Meta API ─────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId } = body as { userId: string; storeId: string };

    if (!storeId) {
      return NextResponse.json(
        { error: "storeId is required" },
        { status: 400 }
      );
    }

    const authResult = await verifyApiUser(request, storeId);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const verifiedUserId = authResult.userId;

    // 1. Get user's Meta access token
    const { data: tokenRow } = await supabaseAdmin
      .from("oauth_tokens")
      .select("access_token, expires_at")
      .eq("user_id", verifiedUserId)
      .eq("service", "facebook")
      .single();

    if (!tokenRow?.access_token) {
      return NextResponse.json(
        { error: "Meta not connected. Connect Facebook in Settings first." },
        { status: 401 }
      );
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Meta token expired. Please reconnect Facebook in Settings." },
        { status: 401 }
      );
    }

    // 2. Fetch all ad accounts from Meta
    const accessToken = tokenRow.access_token;
    const meRes = await fetch(
      `${META_API}/me/adaccounts?fields=id,name,account_status,currency,business_name&limit=100&access_token=${accessToken}`
    );

    if (!meRes.ok) {
      const err = await meRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Failed to fetch ad accounts from Meta", details: err },
        { status: 502 }
      );
    }

    const meData = await meRes.json();
    const accounts = meData.data as {
      id: string;
      name: string;
      account_status: number;
      currency?: string;
      business_name?: string;
    }[];

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: "No ad accounts found on this Facebook account" },
        { status: 404 }
      );
    }

    // 3. Upsert all discovered accounts
    const rows = accounts.map((acct) => ({
      user_id: verifiedUserId,
      store_id: storeId,
      ad_account_id: acct.id,
      account_name: acct.name || acct.business_name || acct.id,
      account_status: acct.account_status,
      active: true, // Default all to active on first discovery
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("user_ad_accounts")
      .upsert(rows, { onConflict: "user_id,ad_account_id" });

    if (upsertError) {
      console.error("Failed to save ad accounts:", upsertError.message);
      return NextResponse.json(
        { error: "Failed to save ad accounts", details: upsertError.message },
        { status: 500 }
      );
    }

    // 4. Return updated list
    const { data: saved } = await supabaseAdmin
      .from("user_ad_accounts")
      .select("id, user_id, store_id, ad_account_id, account_name, account_status, active, created_at")
      .eq("user_id", verifiedUserId)
      .eq("store_id", storeId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      discovered: accounts.length,
      accounts: saved || [],
      message: `Found ${accounts.length} ad account${accounts.length !== 1 ? "s" : ""}`,
    });
  } catch (err) {
    console.error("Ad account discovery error:", err);
    return NextResponse.json(
      { error: "Internal server error during ad account discovery" },
      { status: 500 }
    );
  }
}

// ── PATCH: Toggle active status ──────────────────────────────

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { accountId, active } = body as { accountId: string; active: boolean };

    if (!accountId || typeof active !== "boolean") {
      return NextResponse.json(
        { error: "accountId and active (boolean) are required" },
        { status: 400 }
      );
    }

    const authResult = await verifyApiUser(request);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { error } = await supabaseAdmin
      .from("user_ad_accounts")
      .update({ active })
      .eq("id", accountId)
      .eq("user_id", authResult.userId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update ad account", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Ad account update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
