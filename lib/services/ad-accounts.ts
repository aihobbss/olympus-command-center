// Client-side service for managing multiple Meta ad accounts

import { authFetch } from "@/lib/supabase";

export type UserAdAccount = {
  id: string;
  user_id: string;
  store_id: string;
  ad_account_id: string;  // "act_123456789"
  account_name: string;
  account_status: number; // 1=ACTIVE, 2=DISABLED, etc.
  active: boolean;        // User toggle for including in syncs
  created_at: string;
};

// ── Fetch saved ad accounts ──────────────────────────────────

export async function fetchAdAccounts(
  userId: string,
  storeId: string
): Promise<UserAdAccount[]> {
  const res = await authFetch(
    `/api/meta/ad-accounts?userId=${userId}&storeId=${storeId}`
  );
  const data = await res.json();
  return data.accounts || [];
}

// ── Discover ad accounts from Meta API ───────────────────────

export async function discoverAdAccounts(
  userId: string,
  storeId: string
): Promise<{ accounts: UserAdAccount[]; error?: string }> {
  const res = await authFetch("/api/meta/ad-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, storeId }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { accounts: [], error: data.error || "Failed to discover ad accounts" };
  }

  return { accounts: data.accounts || [] };
}

// ── Toggle account active status ─────────────────────────────

export async function toggleAdAccount(
  accountId: string,
  active: boolean
): Promise<boolean> {
  const res = await authFetch("/api/meta/ad-accounts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, active }),
  });

  return res.ok;
}
