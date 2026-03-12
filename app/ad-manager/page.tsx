"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import type { CampaignStatus } from "@/data/mock";
import { cn } from "@/lib/utils";
import { MetricCard, TimePeriodSelector } from "@/components/ui";
import type { TimePeriod } from "@/components/ui";
import { CampaignCard } from "@/components/modules/CampaignCard";
import { AdActionPanel } from "@/components/modules/AdActionPanel";
import { AdCharts } from "@/components/modules/AdCharts";
import { AdCreatorSheet } from "@/components/modules/AdCreatorSheet";
import { ServiceConnectionOverlay } from "@/components/modules/ServiceConnectionCard";
import type { AdCampaign } from "@/data/mock";
import { useStoreContext, useAuthStore, useConnectionsStore } from "@/lib/store";
import { SERVICE_REGISTRY } from "@/lib/services/connections";
import {
  fetchLiveCampaigns,
  triggerMetaSync,
  killCampaign,
  scaleCampaign,
  passCampaign,
  getLastSyncedAt,
} from "@/lib/services/meta-campaigns";

type AdTab = "live" | "creator";

// ─── Exchange rates (store currency → USD) ─────────────────
const STORE_TO_USD: Record<string, number> = { UK: 1.27, AU: 0.63 };

function computeRecommendation(c: {
  spend: number;
  cpc: number;
  atc: number;
  roas: number;
  orders?: number;
}): { status: AdCampaign["status"]; recommendation: string } {
  const orders = c.orders ?? 0;

  // Kill rules (check in order of spend threshold)
  // CPC > $1 + 0 ATC + $10 spent → Kill
  if (c.spend >= 10 && c.cpc > 1 && c.atc === 0) {
    return {
      status: "Kill",
      recommendation: `$${Math.round(c.spend)} spent, CPC > $1, 0 ATC — SOP: Kill`,
    };
  }
  // 0 ATC + $20 spent → Kill
  if (c.spend >= 20 && c.atc === 0) {
    return {
      status: "Kill",
      recommendation: `$${Math.round(c.spend)} spent, 0 ATC — SOP: Kill`,
    };
  }
  // No sales + $30 spent → Kill
  if (c.spend >= 30 && orders === 0) {
    return {
      status: "Kill",
      recommendation: `$${Math.round(c.spend)} spent, 0 sales — SOP: Kill`,
    };
  }
  // < 2 sales + $60 spent → Kill
  if (c.spend >= 60 && orders < 2) {
    return {
      status: "Kill",
      recommendation: `$${Math.round(c.spend)} spent, only ${orders} sale${orders === 1 ? "" : "s"} — SOP: Kill`,
    };
  }

  // Scale rules
  // ROAS >= 2.0 + ATC >= 5 → Scale
  if (c.roas >= 2.0 && c.atc >= 5) {
    return {
      status: "Scaling",
      recommendation: `ROAS ${c.roas.toFixed(1)}x with ${c.atc} ATC — SOP: Scale +100%`,
    };
  }

  // Watch rules
  // ROAS 1.0–2.0 → Watch
  if (c.roas >= 1.0 && c.roas < 2.0) {
    return {
      status: "Watch",
      recommendation: `ROAS ${c.roas.toFixed(1)}x — profitable but below scale threshold — SOP: Watch`,
    };
  }

  return {
    status: "Watch",
    recommendation: `Monitoring — data insufficient for a strong signal`,
  };
}

// ─── Page ───────────────────────────────────────────────────

export default function AdManagerPage() {
  const { selectedStore } = useStoreContext();
  const user = useAuthStore((s) => s.user);
  const { loadConnections, isConnected } = useConnectionsStore();

  useEffect(() => {
    if (user) loadConnections();
  }, [user, loadConnections]);

  const metaConnected = isConnected("facebook");
  const shopifyConnected = isConnected("shopify");
  const allConnected = metaConnected && shopifyConnected;

  const missingServices = [
    ...(!metaConnected
      ? [{ service: "facebook" as const, meta: SERVICE_REGISTRY.find((s) => s.id === "facebook")! }]
      : []),
    ...(!shopifyConnected
      ? [{ service: "shopify" as const, meta: SERVICE_REGISTRY.find((s) => s.id === "shopify")! }]
      : []),
  ];

  const [activeTab, setActiveTab] = useState<AdTab>("live");
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [selectedCampaign, setSelectedCampaign] =
    useState<AdCampaign | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("Active");

  const storeCurrency = selectedStore?.currency ?? "";
  const rate = STORE_TO_USD[selectedStore?.market ?? ""] ?? 1;
  const toUsd = useCallback(
    (localAmount: number) => Math.round(localAmount * rate),
    [rate]
  );

  const storeId = selectedStore?.id ?? "";

  // ── Map period to Meta date_preset ──
  const DATE_PRESET: Record<TimePeriod, string> = {
    today: "today",
    "3d": "last_3d",
    "7d": "last_7d",
    "30d": "last_30d",
    all: "maximum",
  };

  // ── Load campaigns from Supabase on mount + after sync ──
  const loadCampaigns = useCallback(async () => {
    if (!storeId) return;
    const data = await fetchLiveCampaigns(storeId);
    // Re-compute SOP recommendations on the client
    const withRecs = data.map((c) => {
      const { status, recommendation } = computeRecommendation(c);
      return { ...c, status, recommendation };
    });
    setCampaigns(withRecs);
    const synced = await getLastSyncedAt(storeId);
    setLastSynced(synced);
  }, [storeId]);

  useEffect(() => {
    if (metaConnected && storeId) loadCampaigns();
  }, [metaConnected, storeId, loadCampaigns]);

  // ── Sync from Meta ──
  const handleSync = useCallback(async () => {
    if (!user || !storeId) return;
    setSyncing(true);
    setSyncError(null);
    const result = await triggerMetaSync(user.id, storeId, DATE_PRESET[period]);
    if (result.error) {
      setSyncError(result.error);
    } else {
      await loadCampaigns();
    }
    setSyncing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, storeId, period, loadCampaigns]);

  // ── Auto-sync on first load if connected ──
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  useEffect(() => {
    if (metaConnected && user && storeId && !hasAutoSynced) {
      setHasAutoSynced(true);
      handleSync();
    }
  }, [metaConnected, user, storeId, hasAutoSynced, handleSync]);

  // ── Re-sync when period changes (after initial sync) ──
  useEffect(() => {
    if (hasAutoSynced && metaConnected && user && storeId) {
      handleSync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // ── Filter campaigns by status ──
  const filteredCampaigns = useMemo(() => {
    if (statusFilter === "all") return campaigns;
    return campaigns.filter((c) => c.campaignStatus === statusFilter);
  }, [campaigns, statusFilter]);

  // ── Status counts for filter pills ──
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: campaigns.length };
    for (const c of campaigns) {
      counts[c.campaignStatus] = (counts[c.campaignStatus] ?? 0) + 1;
    }
    return counts;
  }, [campaigns]);

  // ── Aggregated metrics (from filtered view) ──

  const totals = useMemo(() => {
    let spend = 0,
      revenue = 0,
      profit = 0,
      orders = 0;
    for (const c of filteredCampaigns) {
      spend += c.spend;
      revenue += c.revenue;
      profit += c.profit;
      orders += c.orders;
    }
    const roas = spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;
    return { spend, revenue, profit, orders, roas };
  }, [filteredCampaigns]);

  // ── Card click → open panel ──

  const handleCardClick = useCallback((campaign: AdCampaign) => {
    setSelectedCampaign(campaign);
    setPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // ── Panel actions ──

  const handleScale = useCallback(async (id: string, newBudget: number) => {
    if (!user) return;
    setPanelOpen(false);
    const result = await scaleCampaign(user.id, id, newBudget);
    if (result.success) {
      await loadCampaigns();
    } else {
      setSyncError(result.error || "Failed to scale campaign");
    }
  }, [user, loadCampaigns]);

  const handleKill = useCallback(async (id: string) => {
    if (!user) return;
    setPanelOpen(false);
    const result = await killCampaign(user.id, id);
    if (result.success) {
      await loadCampaigns();
    } else {
      setSyncError(result.error || "Failed to kill campaign");
    }
  }, [user, loadCampaigns]);

  const handlePass = useCallback(async (id: string) => {
    if (!user) return;
    setPanelOpen(false);
    const result = await passCampaign(user.id, id);
    if (result.success) {
      await loadCampaigns();
    } else {
      setSyncError(result.error || "Failed to pass campaign");
    }
  }, [user, loadCampaigns]);

  const tabs: { key: AdTab; label: string }[] = [
    { key: "live", label: "Live Campaigns" },
    { key: "creator", label: "Ad Creator" },
  ];

  if (!selectedStore) return null;

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
            <BarChart3
              className="text-accent-indigo"
              size={20}
              strokeWidth={1.8}
            />
          </div>
          <div>
            <h1 className="text-2xl font-syne font-bold tracking-tight">
              Ad Manager
            </h1>
            <p className="text-sm text-text-secondary">
              {activeTab === "live"
                ? "Live Meta campaigns with kill/scale recommendations"
                : "Build & push test campaigns in bulk"}
            </p>
          </div>
        </div>

        {activeTab === "live" && allConnected && (
          <div className="flex items-center gap-3">
            <TimePeriodSelector value={period} onChange={setPeriod} />
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-border-subtle transition-all text-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>
        )}
      </div>

      {/* ─── Connection gate — require both Meta + Shopify ─── */}
      {!allConnected ? (
        <ServiceConnectionOverlay
          moduleName="Ad Manager"
          services={missingServices.map(({ service, meta }) => ({
            service,
            description: meta.description,
            onConnect: () => { window.location.href = meta.connectUrl; },
          }))}
        />
      ) : (
        <>
          {/* ─── Tab Switcher ─── */}
          <div className="flex gap-1 p-1 rounded-xl bg-bg-elevated/60 w-fit mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-accent-indigo text-white shadow-lg shadow-accent-indigo/20"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Live Campaigns Tab ─── */}
          {activeTab === "live" && (
            <>
              {/* ─── Metric Cards ─── */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <MetricCard
                  label="Total Spend"
                  value={totals.spend}
                  format="currency"
                  currency="$"
                />
                <MetricCard
                  label="Revenue"
                  value={totals.revenue}
                  format="currency"
                  currency={storeCurrency}
                  subtitle={`$${toUsd(totals.revenue).toLocaleString("en-GB")} USD`}
                />
                <MetricCard
                  label="Profit"
                  value={totals.profit}
                  format="currency"
                  currency={storeCurrency}
                  subtitle={`$${toUsd(totals.profit).toLocaleString("en-GB")} USD`}
                />
                <MetricCard label="Orders" value={totals.orders} format="number" />
                <MetricCard
                  label="Avg ROAS"
                  value={totals.roas}
                  format="number"
                  className="col-span-2 lg:col-span-1"
                />
              </div>

              {/* ─── Status Filter + Sync Status ─── */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  {(["Active", "Paused", "Killed", "all"] as const).map((s) => {
                    const count = statusCounts[s] ?? 0;
                    if (s !== "all" && count === 0) return null;
                    const label = s === "all" ? "All" : s;
                    const active = statusFilter === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          active
                            ? s === "Active" ? "bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30"
                            : s === "Killed" ? "bg-accent-red/15 text-accent-red border border-accent-red/30"
                            : s === "Paused" ? "bg-accent-amber/15 text-accent-amber border border-accent-amber/30"
                            : "bg-accent-indigo/15 text-accent-indigo border border-accent-indigo/30"
                            : "bg-white/[0.04] text-text-muted border border-transparent hover:text-text-secondary"
                        )}
                      >
                        {label}
                        <span className="ml-1 opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {lastSynced && (
                    <span className="text-text-muted">
                      Last synced: {new Date(lastSynced).toLocaleString()}
                    </span>
                  )}
                  {syncError && (
                    <span className="text-accent-red">{syncError}</span>
                  )}
                </div>
              </div>

              {/* ─── Empty state ─── */}
              {filteredCampaigns.length === 0 && !syncing && (
                <div className="text-center py-16 text-text-muted">
                  <p className="text-lg font-medium mb-2">
                    {campaigns.length === 0 ? "No campaigns found" : `No ${statusFilter === "all" ? "" : statusFilter.toLowerCase()} campaigns`}
                  </p>
                  <p className="text-sm">
                    {campaigns.length === 0
                      ? 'Click "Sync Now" to pull campaigns from Meta, or create campaigns in the Ad Creator tab.'
                      : "Try changing the filter above to see other campaigns."}
                  </p>
                </div>
              )}

              {/* ─── Campaign Grid ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                {filteredCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onClick={handleCardClick}
                    storeCurrency={storeCurrency}
                    toUsd={toUsd}
                  />
                ))}
              </div>

              {/* ─── ROAS Trend Chart ─── */}
              <AdCharts campaigns={filteredCampaigns} />

              {/* ─── Action Panel ─── */}
              <AdActionPanel
                campaign={selectedCampaign}
                open={panelOpen}
                onClose={handleClosePanel}
                onScale={handleScale}
                onKill={handleKill}
                onPass={handlePass}
                storeCurrency={storeCurrency}
                toUsd={toUsd}
              />
            </>
          )}

          {/* ─── Ad Creator Tab ─── */}
          {activeTab === "creator" && <AdCreatorSheet />}
        </>
      )}
    </div>
  );
}
