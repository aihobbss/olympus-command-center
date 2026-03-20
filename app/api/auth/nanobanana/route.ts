import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

// Nanobanana Pro API key connection
// User enters their API key in Settings, we validate + store it.

export async function POST(request: Request) {
  // Verify caller identity via JWT
  const authResult = await verifyApiUser(request);
  if ("error" in authResult) {
    return apiError("unauthorized", authResult.error, authResult.status);
  }
  const userId = authResult.userId;

  const body = await request.json().catch(() => ({}));
  const apiKey = body.apiKey as string;
  const storeId = body.storeId as string | undefined;

  if (!apiKey || apiKey.length < 10) {
    return apiError("invalid_key", "Provide a valid Nanobanana Pro API key.", 400);
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
    return apiError("save_failed", "Failed to save API key.", 500, true);
  }

  return NextResponse.json({ success: true, message: "Nanobanana Pro connected." });
}
