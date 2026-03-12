"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, Shield, X, Key } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  SERVICE_REGISTRY,
  fetchConnections,
  disconnectService,
  isServiceConnected,
  type ServiceConnection,
  type ServiceId,
} from "@/lib/services/connections";
import { ServiceConnectionFull } from "@/components/modules/ServiceConnectionCard";
import { cn } from "@/lib/utils";

// Services that use API key entry (POST) vs OAuth redirect (GET)
const API_KEY_SERVICES: ServiceId[] = ["anthropic", "nanobanana"];

function isApiKeyService(service: ServiceId) {
  return API_KEY_SERVICES.includes(service);
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [connections, setConnections] = useState<ServiceConnection[]>([]);
  const [loading, setLoading] = useState(true);

  // API key modal state
  const [apiKeyModal, setApiKeyModal] = useState<{
    service: ServiceId;
    label: string;
  } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");

  // Shopify domain modal state
  const [shopifyModal, setShopifyModal] = useState(false);
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyError, setShopifyError] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchConnections(user.id).then((conns) => {
      setConnections(conns);
      setLoading(false);
    });
  }, [user]);

  const handleConnect = useCallback(
    (service: ServiceId) => {
      if (!user) return;
      const meta = SERVICE_REGISTRY.find((s) => s.id === service);
      if (!meta) return;

      if (isApiKeyService(service)) {
        // Open API key modal
        setApiKeyInput("");
        setApiKeyError("");
        setApiKeyModal({ service, label: meta.label });
        return;
      }

      if (service === "shopify") {
        // Shopify needs store domain first
        setShopifyDomain("");
        setShopifyError("");
        setShopifyModal(true);
        return;
      }

      // OAuth services (facebook) — redirect with userId
      window.location.href = `${meta.connectUrl}?userId=${user.id}`;
    },
    [user]
  );

  const handleApiKeySubmit = useCallback(async () => {
    if (!apiKeyModal || !user) return;
    setApiKeyLoading(true);
    setApiKeyError("");

    try {
      const meta = SERVICE_REGISTRY.find((s) => s.id === apiKeyModal.service);
      if (!meta) return;

      const res = await fetch(meta.connectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput, userId: user.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setApiKeyError(data.message || "Failed to connect.");
        return;
      }

      // Refresh connections
      const conns = await fetchConnections(user.id);
      setConnections(conns);
      setApiKeyModal(null);
    } catch {
      setApiKeyError("Network error. Please try again.");
    } finally {
      setApiKeyLoading(false);
    }
  }, [apiKeyModal, apiKeyInput, user]);

  const handleShopifySubmit = useCallback(async () => {
    if (!user) return;
    setShopifyLoading(true);
    setShopifyError("");

    try {
      const res = await fetch("/api/auth/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeDomain: shopifyDomain, userId: user.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setShopifyError(data.message || "Failed to start Shopify OAuth.");
        return;
      }

      // Redirect to Shopify OAuth
      if (data.redirect) {
        window.location.href = data.redirect;
      }
    } catch {
      setShopifyError("Network error. Please try again.");
    } finally {
      setShopifyLoading(false);
    }
  }, [shopifyDomain, user]);

  const handleDisconnect = useCallback(
    async (service: ServiceId) => {
      if (!user) return;
      const ok = await disconnectService(user.id, service);
      if (ok) {
        setConnections((prev) => prev.filter((c) => c.service !== service));
      }
    },
    [user]
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
          <Settings className="text-accent-indigo" size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-2xl font-syne font-bold tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-text-secondary">
            Manage your connected services and account preferences
          </p>
        </div>
      </div>

      {/* Connected Services */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-accent-indigo" />
          <h2 className="text-base font-syne font-semibold text-text-primary">
            Connected Services
          </h2>
        </div>
        <p className="text-xs text-text-secondary mb-5 max-w-xl">
          Connect your accounts to enable live data sync across modules.
          OAuth services use secure authorization. API keys are stored encrypted.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="card p-5 animate-pulse"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-white/[0.04]" />
                    <div className="h-3 w-64 rounded bg-white/[0.04]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {SERVICE_REGISTRY.map((svc) => (
              <ServiceConnectionFull
                key={svc.id}
                service={svc.id}
                connected={isServiceConnected(connections, svc.id)}
                description={svc.description}
                onConnect={() => handleConnect(svc.id)}
                onDisconnect={() => handleDisconnect(svc.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Module requirements info */}
      <section>
        <h2 className="text-base font-syne font-semibold text-text-primary mb-4">
          Service Requirements by Module
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-subtle">
                <th className="text-left px-4 py-3 text-text-muted font-medium uppercase tracking-wider">
                  Module
                </th>
                <th className="text-left px-4 py-3 text-text-muted font-medium uppercase tracking-wider">
                  Required Services
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { module: "Product Creation", services: ["Shopify", "Claude AI"] },
                { module: "Ad Manager", services: ["Meta Ads"] },
                { module: "Profit Tracker", services: ["Shopify", "Meta Ads"] },
                { module: "Creative Generator", services: ["Nanobanana Pro"] },
              ].map((row) => (
                <tr key={row.module} className="border-b border-subtle last:border-b-0">
                  <td className="px-4 py-3 text-text-primary font-medium">
                    {row.module}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {row.services.map((s) => {
                        const serviceId = s === "Shopify" ? "shopify" : s === "Meta Ads" ? "facebook" : s === "Claude AI" ? "anthropic" : "nanobanana";
                        const connected = isServiceConnected(connections, serviceId as ServiceId);
                        return (
                          <span
                            key={s}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              connected
                                ? "bg-accent-emerald/10 text-accent-emerald"
                                : "bg-white/[0.06] text-text-muted"
                            }`}
                          >
                            {connected ? "●" : "○"} {s}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* API Key Modal */}
      {apiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setApiKeyModal(null)}
          />
          <div className="relative w-full max-w-md mx-4 card p-6">
            <button
              onClick={() => setApiKeyModal(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
                <Key size={18} className="text-text-secondary" />
              </div>
              <div>
                <h3 className="text-sm font-syne font-semibold text-text-primary">
                  Connect {apiKeyModal.label}
                </h3>
                <p className="text-[11px] text-text-muted">
                  Enter your API key to connect
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={
                  apiKeyModal.service === "anthropic"
                    ? "sk-ant-..."
                    : "Enter your API key"
                }
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-sm",
                  "bg-white/[0.04] border border-subtle",
                  "text-text-primary placeholder:text-text-muted",
                  "focus:outline-none focus:border-accent-indigo/50 focus:ring-1 focus:ring-accent-indigo/20",
                  "transition-colors"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && apiKeyInput) handleApiKeySubmit();
                }}
                autoFocus
              />

              {apiKeyError && (
                <p className="text-xs text-accent-red">{apiKeyError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setApiKeyModal(null)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApiKeySubmit}
                  disabled={!apiKeyInput || apiKeyLoading}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                    "bg-accent-indigo text-white",
                    "hover:bg-accent-indigo/90",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {apiKeyLoading ? "Connecting..." : "Connect"}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-text-muted mt-3">
              Your API key is stored securely and never shared.
            </p>
          </div>
        </div>
      )}

      {/* Shopify Domain Modal */}
      {shopifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShopifyModal(false)}
          />
          <div className="relative w-full max-w-md mx-4 card p-6">
            <button
              onClick={() => setShopifyModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#95BF47]/10 flex items-center justify-center">
                <Key size={18} className="text-[#95BF47]" />
              </div>
              <div>
                <h3 className="text-sm font-syne font-semibold text-text-primary">
                  Connect Shopify
                </h3>
                <p className="text-[11px] text-text-muted">
                  Enter your store domain to begin
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={shopifyDomain}
                onChange={(e) => setShopifyDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-sm",
                  "bg-white/[0.04] border border-subtle",
                  "text-text-primary placeholder:text-text-muted",
                  "focus:outline-none focus:border-[#95BF47]/50 focus:ring-1 focus:ring-[#95BF47]/20",
                  "transition-colors"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && shopifyDomain) handleShopifySubmit();
                }}
                autoFocus
              />

              {shopifyError && (
                <p className="text-xs text-accent-red">{shopifyError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShopifyModal(false)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShopifySubmit}
                  disabled={!shopifyDomain || shopifyLoading}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                    "bg-[#95BF47] text-white",
                    "hover:bg-[#95BF47]/90",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {shopifyLoading ? "Connecting..." : "Connect"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
