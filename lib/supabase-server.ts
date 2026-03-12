import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use in API routes and server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
