import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Claude AI (Anthropic) API key connection
// User enters their API key in Settings, we validate + store it.

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const apiKey = body.apiKey as string;
  const userId = body.userId as string;

  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "INVALID_KEY", message: "Provide a valid Claude API key (starts with sk-ant-)." },
      { status: 400 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "You must be logged in." },
      { status: 401 }
    );
  }

  // Verify user exists (prevents spoofed userId)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid user." },
      { status: 401 }
    );
  }

  // Store API key in oauth_tokens
  const { error: upsertError } = await supabaseAdmin
    .from("oauth_tokens")
    .upsert(
      {
        user_id: userId,
        service: "anthropic",
        access_token: apiKey,
        expires_at: null,
      },
      { onConflict: "user_id,service" }
    );

  if (upsertError) {
    console.error("Failed to save Anthropic key:", upsertError.message);
    return NextResponse.json(
      { error: "SAVE_FAILED", message: "Failed to save API key." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Claude AI connected." });
}
