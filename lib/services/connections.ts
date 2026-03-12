import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────

export type ServiceId = "shopify" | "facebook" | "nanobanana" | "anthropic";

export type ServiceConnection = {
  id: string;
  service: ServiceId;
  connected: boolean;
  expiresAt: string | null;
};

export type ServiceMeta = {
  id: ServiceId;
  label: string;
  description: string;
  icon: "shopify" | "facebook" | "nanobanana" | "anthropic";
  connectUrl: string;
  requiredBy: string[]; // module IDs that need this service
};

export const SERVICE_REGISTRY: ServiceMeta[] = [
  {
    id: "shopify",
    label: "Shopify",
    description: "Push products, sync orders & inventory",
    icon: "shopify",
    connectUrl: "/api/auth/shopify",
    requiredBy: ["product-creation", "ad-manager", "profit-tracker"],
  },
  {
    id: "facebook",
    label: "Meta Ads",
    description: "Sync campaigns, budgets & performance data",
    icon: "facebook",
    connectUrl: "/api/auth/meta",
    requiredBy: ["ad-manager", "profit-tracker"],
  },
  {
    id: "nanobanana",
    label: "Nanobanana Pro",
    description: "AI-powered ad creative generation",
    icon: "nanobanana",
    connectUrl: "/api/auth/nanobanana",
    requiredBy: ["creative-generator"],
  },
  {
    id: "anthropic",
    label: "Claude AI",
    description: "AI-powered product copy & size chart generation",
    icon: "anthropic",
    connectUrl: "/api/auth/anthropic",
    requiredBy: ["product-creation"],
  },
];

// ── Queries ──────────────────────────────────────────────

export async function fetchConnections(userId: string): Promise<ServiceConnection[]> {
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("id, service, expires_at")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to fetch connections:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    service: row.service as ServiceId,
    connected: true,
    expiresAt: row.expires_at,
  }));
}

export async function disconnectService(userId: string, service: ServiceId): Promise<boolean> {
  const { error } = await supabase
    .from("oauth_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("service", service);

  if (error) {
    console.error("Failed to disconnect service:", error.message);
    return false;
  }

  return true;
}

// ── Helpers ──────────────────────────────────────────────

export function getServicesForModule(moduleId: string): ServiceMeta[] {
  return SERVICE_REGISTRY.filter((s) => s.requiredBy.includes(moduleId));
}

export function isServiceConnected(
  connections: ServiceConnection[],
  serviceId: ServiceId
): boolean {
  const conn = connections.find((c) => c.service === serviceId);
  if (!conn) return false;
  // Check expiry
  if (conn.expiresAt && new Date(conn.expiresAt) < new Date()) return false;
  return true;
}
