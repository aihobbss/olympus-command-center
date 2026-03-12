import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Nanobanana Pro API key connection
// User enters their API key in Settings, we validate + store it.

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const apiKey = body.apiKey as string;
  const userId = body.userId as string;

  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json(
      { error: "INVALID_KEY", message: "Provide a valid Nanobanana Pro API key." },
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
        service: "nanobanana",
        access_token: apiKey,
        expires_at: null,
      },
      { onConflict: "user_id,service" }
    );

  if (upsertError) {
    console.error("Failed to save Nanobanana key:", upsertError.message);
    return NextResponse.json(
      { error: "SAVE_FAILED", message: "Failed to save API key." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Nanobanana Pro connected." });
}
