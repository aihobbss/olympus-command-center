import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use in API routes and server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ── Auth helper for API routes ──────────────────────────────
// Verifies the caller's JWT from the Authorization header and returns the
// authenticated user ID. Also confirms the user has access to the given storeId
// (if provided) by checking the user_stores junction table.

export async function verifyApiUser(
  request: Request,
  requiredStoreId?: string
): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.slice(7);

  // ── Internal cron bypass ──────────────────────────────────
  // When the Bearer token matches CRON_SECRET and X-Internal-User-Id is present,
  // trust the header-provided userId without JWT verification.
  // This allows the cron-sync route to call other API routes on behalf of store owners.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && token === cronSecret) {
    const headerUserId = request.headers.get("x-internal-user-id");
    if (headerUserId) {
      // Skip store membership check for cron — the cron job is trusted
      return { userId: headerUserId };
    }
    return { error: "CRON_SECRET used without X-Internal-User-Id header", status: 401 };
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid or expired token", status: 401 };
  }

  // Optionally verify store membership
  if (requiredStoreId) {
    const { data: membership } = await supabaseAdmin
      .from("user_stores")
      .select("store_id")
      .eq("user_id", user.id)
      .eq("store_id", requiredStoreId)
      .single();

    if (!membership) {
      return { error: "User does not have access to this store", status: 403 };
    }
  }

  return { userId: user.id };
}
