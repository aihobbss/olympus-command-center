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
      const timeoutMs = 15_000;
      if (init?.signal) {
        // ALWAYS enforce a timeout even when a caller provides their own signal.
        // Previously the timeout was skipped when a custom signal was set, meaning
        // requests could hang forever if the network stalled after a tab switch.
        const signal = AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]);
        return fetch(input, { ...init, signal });
      }
      return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    },
  },
});

// ── Authenticated API fetch helper ──────────────────────────
// Attaches the current Supabase session JWT as a Bearer token so API routes
// can verify the caller's identity via verifyApiUser().
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  // Default 30s timeout prevents hung fetches from blocking the connection pool
  // and leaving loading spinners stuck. Callers can override with their own signal.
  const signal = init?.signal ?? AbortSignal.timeout(30_000);
  return fetch(url, { ...init, headers, signal });
}
