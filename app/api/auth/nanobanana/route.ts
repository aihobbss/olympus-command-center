import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";

// Nanobanana Pro API key connection
// User enters their API key in Settings, we validate + store it.

export async function POST(request: Request) {
  // Verify caller identity via JWT
  const authResult = await verifyApiUser(request);
  if ("error" in authResult) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: authResult.error },
      { status: authResult.status }
    );
  }
  const userId = authResult.userId;

  const body = await request.json().catch(() => ({}));
  const apiKey = body.apiKey as string;
  const storeId = body.storeId as string | undefined;

  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json(
      { error: "INVALID_KEY", message: "Provide a valid Nanobanana Pro API key." },
      { status: 400 }
    );
  }

  // Store API key in oauth_tokens (scoped to store if provided)
  const tokenRow: Record<string, unknown> = {
    user_id: userId,
    service: "nanobanana",
    access_token: apiKey,
    expires_at: null,
  };
  if (storeId) tokenRow.store_id = storeId;

  const { error: upsertError } = await supabaseAdmin
    .from("oauth_tokens")
    .upsert(tokenRow, { onConflict: storeId ? "store_id,service" : "user_id,service" });

  if (upsertError) {
    console.error("Failed to save Nanobanana key:", upsertError.message);
    return NextResponse.json(
      { error: "SAVE_FAILED", message: "Failed to save API key." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Nanobanana Pro connected." });
}
