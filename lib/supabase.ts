import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key, respects RLS)
// Global fetch timeout prevents hung requests from blocking the browser connection pool.
// Without this, rapid navigation can exhaust the ~6 concurrent connections per origin,
// causing ALL subsequent requests (and pages) to hang indefinitely.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => {
      // Only add a timeout if no signal is already set
      const signal = init?.signal ?? AbortSignal.timeout(15000);
      return fetch(input, { ...init, signal });
    },
  },
});
