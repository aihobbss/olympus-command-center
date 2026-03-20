import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";

// Claude AI (Anthropic) API key connection
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

  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "INVALID_KEY", message: "Provide a valid Claude API key (starts with sk-ant-)." },
      { status: 400 }
    );
  }

  // Store API key in oauth_tokens (scoped to store if provided)
  const tokenRow: Record<string, unknown> = {
    user_id: userId,
    service: "anthropic",
    access_token: apiKey,
    expires_at: null,
  };
  if (storeId) tokenRow.store_id = storeId;

  const { error: upsertError } = await supabaseAdmin
    .from("oauth_tokens")
    .upsert(tokenRow, { onConflict: storeId ? "store_id,service" : "user_id,service" });

  if (upsertError) {
    console.error("Failed to save Anthropic key:", upsertError.message);
    return NextResponse.json(
      { error: "SAVE_FAILED", message: "Failed to save API key." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Claude AI connected." });
}
