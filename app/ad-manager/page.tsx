"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { BarChart3, RefreshCw, ChevronDown, Check } from "lucide-react";
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
  fetchDailyInsights,
  aggregateDailyInsights,
  type DailyInsightRow,
} from "@/lib/services/meta-campaigns";
import { fetchProfitLogsByDateRange, triggerProfitSync } from "@/lib/services/profit-tracker";
import { fetchAdAccounts, discoverAdAccounts, type UserAdAccount } from "@/lib/services/ad-accounts";

type AdTab = "live" | "creator";

// ─── Exchange rates (store currency → USD) ─────────────────
const STORE_TO_USD: Record<string, number> = { UK: 1.27, AU: 0.63 };

// ─── Cache staleness threshold (3 minutes) ──────────────────
const CACHE_TTL_MS = 3 * 60 * 1000;

// ─── Days back per period ──────────────────────────────────
const DAYS_BACK: Record<TimePeriod, number> = {
  today: 0,
  "3d": 3,
  "7d": 7,
  "30d": 30,
  all: 3650,
};

function getDateRange(p: TimePeriod): { start: string; end: string } {
  const end = new Date();
  if (p === "all") {
    return { start: "2000-01-01", end: end.toISOString().split("T")[0] };
  }
  const start = new Date();
  start.setDate(start.getDate() - DAYS_BACK[p]);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

function computeRecommendation(c: {
  spend: number;
  cpc: number;
  atc: number;
  roas: number;
  orders?: number;
}): { status: AdCampaign["status"]; recommendation: string } {
  const orders = c.orders ?? 0;

  if (c.spend >= 10 && c.cpc > 1 && c.atc === 0) {
    return {
      status: "Kill",
      recommendation: `$${Math.round(c.spend)} spent, CPC > $1, 0 ATC — SOP: Kill`,
    };
  }
  if (c.spend >= 20 && c.atc === 0) {
    return {
      status: "Kill",
      recommendation: `$${Math.round(c.spend)} spent, 0 ATC — SOP: Kill`,
    };
  }
  if (c.spend >= 30 && orders === 0) {
    return {
      status: "Kill",
      recommendation: `$${Math.round(c.spend)} spent, 0 sales — SOP: Kill`,
    };
  }
  if (c.spend >= 60 && orders < 2) {
    return {
      status: "Kill",
      recommendation: `$${Math.round(c.spend)} spent, only ${orders} sale${orders === 1 ? "" : "s"} — SOP: Kill`,
    };
  }
  if (c.roas >= 2.0 && c.atc >= 5) {
    return {
      status: "Scaling",
      recommendation: `ROAS ${c.roas.toFixed(1)}x with ${c.atc} ATC — SOP: Scale +100%`,
    };
  }
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
  const [selectedCampaign, setSelectedCampaign] = useState<AdCampaign | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"live" | "paused" | "all">("live");
  const [shopifyTotals, setShopifyTotals] = useState({ revenue: 0, orders: 0, profit: 0 });
  const [allProfitLogs, setAllProfitLogs] = useState<{ date: string; revenue: number; orders?: number; profit: number }[]>([]);

  // All daily insight rows from Supabase (widest range) — filtered locally by period + account
  const [allDailyInsights, setAllDailyInsights] = useState<DailyInsightRow[]>([]);

  // First-sync flag: true when no account selection saved AND no insights exist
  const [isFirstSync, setIsFirstSync] = useState(false);

  // ── Multi-currency toggle state (matches profit-tracker pattern) ──
  const [swappedCards, setSwappedCards] = useState<Set<string>>(new Set());
  const toggleCard = useCallback((key: string) => {
    setSwappedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const storeId = selectedStore?.id ?? "";
  const loadedStoreRef = useRef<string | null>(null);

  // ── Ad account switcher state ──
  const [adAccounts, setAdAccounts] = useState<UserAdAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  // Restore saved selection from localStorage
  useEffect(() => {
    if (!storeId) return;
    try {
      const saved = localStorage.getItem(`ad-accounts-selection:${storeId}`);
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        if (Array.isArray(ids) && ids.length > 0) {
          setSelectedAccountIds(new Set(ids));
        } else {
          setSelectedAccountIds(new Set());
        }
      } else {
        setSelectedAccountIds(new Set());
      }
    } catch {
      setSelectedAccountIds(new Set());
    }
  }, [storeId]);

  const updateSelection = useCallback((next: Set<string>) => {
    setSelectedAccountIds(next);
    if (storeId) {
      try {
        localStorage.setItem(`ad-accounts-selection:${storeId}`, JSON.stringify(Array.from(next)));
      } catch { /* quota exceeded — non-critical */ }
    }
  }, [storeId]);

  const allSelected = selectedAccountIds.size === 0 || selectedAccountIds.size === adAccounts.length;

  const toggleAccount = useCallback((accountId: string) => {
    const next = new Set(selectedAccountIds);
    if (next.has(accountId)) {
      next.delete(accountId);
    } else {
      next.add(accountId);
    }
    updateSelection(next.size === adAccounts.length ? new Set() : next);
  }, [selectedAccountIds, adAccounts.length, updateSelection]);

  const toggleAll = useCallback(() => {
    updateSelection(new Set());
  }, [updateSelection]);

  const storeCurrency = selectedStore?.currency ?? "";
  const rate = STORE_TO_USD[selectedStore?.market ?? ""] ?? 1;
  const currencySymbol = storeCurrency === "AUD" ? "A$" : storeCurrency === "GBP" ? "£" : "$";
  const currencyCode = selectedStore?.market === "UK" ? "GBP" : selectedStore?.market === "AU" ? "AUD" : "USD";
  const toUsd = useCallback(
    (localAmount: number) => Math.round(localAmount * rate),
    [rate]
  );

  // ── Load ad accounts ──
  useEffect(() => {
    if (!user || !storeId || !metaConnected) return;
    let cancelled = false;

    (async () => {
      const result = await discoverAdAccounts(user.id, storeId);
      if (cancelled) return;
      if (result.accounts.length > 0) {
        setAdAccounts(result.accounts);
      } else {
        const cached = await fetchAdAccounts(user.id, storeId);
        if (cancelled) return;
        setAdAccounts(cached);
      }
    })();

    return () => { cancelled = true; };
  }, [user, storeId, metaConnected]);

  // ── Load cached data from Supabase (campaigns + daily insights + profit logs) ──
  const loadCachedData = useCallback(async () => {
    if (!storeId) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const [campaignData, insights, profitLogs, synced] = await Promise.all([
      fetchLiveCampaigns(storeId),
      fetchDailyInsights(storeId, "2000-01-01", todayStr),
      fetchProfitLogsByDateRange(storeId, "2000-01-01", todayStr),
      getLastSyncedAt(storeId),
    ]);
    setCampaigns(campaignData);
    setAllDailyInsights(insights);
    setAllProfitLogs(profitLogs);
    setLastSynced(synced);

    // First sync = no insights data yet. User must select accounts and click "Sync Now".
    setIsFirstSync(insights.length === 0 && campaignData.length === 0);
  }, [storeId]);

  // ── Filter daily insights by period + selected ad accounts ──
  const filteredInsights = useMemo(() => {
    const { start, end } = getDateRange(period);
    let rows = allDailyInsights.filter((r) => r.date >= start && r.date <= end);
    if (!allSelected) {
      rows = rows.filter((r) => selectedAccountIds.has(r.ad_account_id));
    }
    return rows;
  }, [allDailyInsights, period, selectedAccountIds, allSelected]);

  // ── Aggregate filtered insights into store-wide + per-campaign metrics ──
  const insightMetrics = useMemo(() => aggregateDailyInsights(filteredInsights), [filteredInsights]);

  // ── Compute shopifyTotals from profit logs filtered by period ──
  useEffect(() => {
    if (allProfitLogs.length === 0) {
      setShopifyTotals({ revenue: 0, orders: 0, profit: 0 });
      return;
    }
    const { start, end } = getDateRange(period);
    let rev = 0, ord = 0, prof = 0;
    for (const log of allProfitLogs) {
      if (log.date >= start && log.date <= end) {
        rev += log.revenue;
        ord += log.orders ?? 0;
        prof += log.profit;
      }
    }
    setShopifyTotals({ revenue: rev, orders: ord, profit: prof });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProfitLogs, period]);

  // ── Enrich campaign objects with period-filtered metrics from daily insights ──
  const enrichedCampaigns = useMemo(() => {
    return campaigns.map((c) => {
      // Match campaign to aggregated daily insights via metaCampaignId
      const metrics = c.metaCampaignId
        ? insightMetrics.byCampaign.get(c.metaCampaignId)
        : undefined;

      if (metrics) {
        const roas = metrics.spend > 0
          ? parseFloat((metrics.purchaseValue / metrics.spend).toFixed(2))
          : 0;
        const orders = metrics.purchases;
        const { status, recommendation } = computeRecommendation({
          spend: metrics.spend,
          cpc: metrics.cpc,
          atc: metrics.atc,
          roas,
          orders,
        });
        return {
          ...c,
          spend: metrics.spend,
          cpc: metrics.cpc,
          atc: metrics.atc,
          roas,
          revenue: metrics.purchaseValue,
          orders,
          profit: metrics.purchaseValue - metrics.spend,
          status,
          recommendation,
        };
      }

      // No insights for this campaign in the selected period — zero out metrics
      const { status, recommendation } = computeRecommendation({
        spend: 0, cpc: 0, atc: 0, roas: 0, orders: 0,
      });
      return { ...c, spend: 0, cpc: 0, atc: 0, roas: 0, revenue: 0, orders: 0, profit: 0, status, recommendation };
    });
  }, [campaigns, insightMetrics]);

  // ── Background sync ──
  const runBackgroundSync = useCallback(async () => {
    if (!user || !storeId) return;
    setBackgroundSyncing(true);
    setSyncError(null);
    try {
      const results = await Promise.allSettled([
        triggerMetaSync(user.id, storeId),
        triggerProfitSync(user.id, storeId, 30, selectedAccountIds.size > 0 ? Array.from(selectedAccountIds) : undefined),
      ]);
      if (results[0].status === "fulfilled" && results[0].value.error) {
        setSyncError(results[0].value.error);
      } else if (results[0].status === "rejected") {
        setSyncError("Meta sync failed — check your connection");
      }
      await loadCachedData();
    } catch {
      setSyncError("Sync failed — check your connections in Settings");
      try { await loadCachedData(); } catch { /* ignore */ }
    } finally {
      setBackgroundSyncing(false);
    }
  }, [user, storeId, selectedAccountIds, loadCachedData]);

  // ── Manual "Sync Now" ──
  const handleSync = useCallback(async () => {
    if (!user || !storeId) return;
    setSyncing(true);
    setSyncError(null);

    // On first sync, persist the current account selection so future visits auto-sync
    if (!localStorage.getItem(`ad-accounts-selection:${storeId}`)) {
      localStorage.setItem(`ad-accounts-selection:${storeId}`, JSON.stringify(Array.from(selectedAccountIds)));
    }

    try {
      const results = await Promise.allSettled([
        triggerMetaSync(user.id, storeId),
        triggerProfitSync(user.id, storeId, 30, selectedAccountIds.size > 0 ? Array.from(selectedAccountIds) : undefined),
      ]);
      if (results[0].status === "fulfilled" && results[0].value.error) {
        setSyncError(results[0].value.error);
      } else if (results[0].status === "rejected") {
        setSyncError("Meta sync failed — check your connection");
      }
      await loadCachedData();
      setIsFirstSync(false);
    } catch {
      setSyncError("Sync failed — check your connections in Settings");
      try { await loadCachedData(); } catch { /* ignore */ }
    } finally {
      setSyncing(false);
    }
  }, [user, storeId, selectedAccountIds, loadCachedData]);

  // ── Cache-first load on mount / store change ──
  // First-sync guard: if no daily insights exist yet, skip auto-sync entirely.
  // User must select ad accounts and manually click "Sync Now" for the first pull.
  useEffect(() => {
    if (!metaConnected || !user || !storeId) return;
    if (loadedStoreRef.current === storeId) return;
    loadedStoreRef.current = storeId;

    let cancelled = false;

    (async () => {
      await loadCachedData();
      if (cancelled) return;

      // If no insights data exists, this is a first sync — user must pick accounts first
      const syncedAt = await getLastSyncedAt(storeId);
      if (cancelled) return;

      if (!syncedAt) {
        // No data yet — wait for user to select accounts and click "Sync Now"
        return;
      }

      const isStale = Date.now() - new Date(syncedAt).getTime() > CACHE_TTL_MS;
      if (isStale) {
        runBackgroundSync();
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaConnected, user, storeId]);

  // ── Filter campaigns by account + status ──
  const isLive = (c: AdCampaign) => c.campaignStatus === "Active" || c.campaignStatus === "Scaling";

  const accountFilteredCampaigns = useMemo(() => {
    if (allSelected) return enrichedCampaigns;
    return enrichedCampaigns.filter((c) => c.adAccountId && selectedAccountIds.has(c.adAccountId));
  }, [enrichedCampaigns, selectedAccountIds, allSelected]);

  const filteredCampaigns = useMemo(() => {
    if (statusFilter === "all") return accountFilteredCampaigns;
    if (statusFilter === "live") return accountFilteredCampaigns.filter(isLive);
    return accountFilteredCampaigns.filter((c) => !isLive(c));
  }, [accountFilteredCampaigns, statusFilter]);

  const liveCount = useMemo(() => accountFilteredCampaigns.filter(isLive).length, [accountFilteredCampaigns]);
  const pausedCount = accountFilteredCampaigns.length - liveCount;

  // ── Aggregated metrics (spend from daily insights, revenue/profit from profit logs) ──
  const totals = useMemo(() => {
    const spend = insightMetrics.totalSpend;
    const roas = spend > 0 ? parseFloat((shopifyTotals.revenue / spend).toFixed(2)) : 0;
    return {
      spend,
      revenue: shopifyTotals.revenue,
      profit: shopifyTotals.profit,
      orders: shopifyTotals.orders,
      roas,
    };
  }, [insightMetrics, shopifyTotals]);

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
      await loadCachedData();
    } else {
      setSyncError(result.error || "Failed to scale campaign");
    }
  }, [user, loadCachedData]);

  const handleKill = useCallback(async (id: string) => {
    if (!user) return;
    setPanelOpen(false);
    const result = await killCampaign(user.id, id);
    if (result.success) {
      await loadCachedData();
    } else {
      setSyncError(result.error || "Failed to kill campaign");
    }
  }, [user, loadCachedData]);

  const handlePass = useCallback(async (id: string) => {
    if (!user) return;
    setPanelOpen(false);
    const result = await passCampaign(user.id, id);
    if (result.success) {
      await loadCachedData();
    } else {
      setSyncError(result.error || "Failed to pass campaign");
    }
  }, [user, loadCachedData]);

  const tabs: { key: AdTab; label: string }[] = [
    { key: "live", label: "Live Campaigns" },
    { key: "creator", label: "Ad Creator" },
  ];

  const selectedAccountLabel = allSelected
    ? "All Accounts"
    : selectedAccountIds.size === 1
      ? adAccounts.find((a) => selectedAccountIds.has(a.ad_account_id))?.account_name || "1 Account"
      : `${selectedAccountIds.size} Accounts`;

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
            {/* ─── Ad Account Switcher ─── */}
            {adAccounts.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                    !allSelected
                      ? "bg-accent-indigo/10 text-accent-indigo border-accent-indigo/30"
                      : "bg-bg-elevated text-text-secondary border-subtle hover:text-text-primary hover:bg-border-subtle"
                  )}
                >
                  <span className="max-w-[160px] truncate">{selectedAccountLabel}</span>
                  <ChevronDown size={12} className={cn("transition-transform", accountDropdownOpen && "rotate-180")} />
                </button>

                {accountDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setAccountDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg bg-bg-card border border-subtle shadow-xl overflow-hidden">
                      <button
                        onClick={toggleAll}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors",
                          allSelected
                            ? "bg-accent-indigo/10 text-accent-indigo font-medium"
                            : "text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                        )}
                      >
                        <div className={cn(
                          "w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0",
                          allSelected ? "bg-accent-indigo border-accent-indigo" : "border-text-muted"
                        )}>
                          {allSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        All Accounts
                        <span className="ml-auto text-text-muted">({adAccounts.length})</span>
                      </button>
                      <div className="border-t border-subtle" />
                      {adAccounts.map((acct) => {
                        const checked = allSelected || selectedAccountIds.has(acct.ad_account_id);
                        return (
                          <button
                            key={acct.ad_account_id}
                            onClick={() => toggleAccount(acct.ad_account_id)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors",
                              checked && !allSelected
                                ? "bg-accent-indigo/5 text-accent-indigo"
                                : "text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                            )}
                          >
                            <div className={cn(
                              "w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0",
                              checked ? "bg-accent-indigo border-accent-indigo" : "border-text-muted"
                            )}>
                              {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <div className="min-w-0 text-left">
                              <span className="block truncate">{acct.account_name}</span>
                              <span className="text-[10px] text-text-muted font-mono-metric">
                                {acct.ad_account_id.replace("act_", "")}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            <TimePeriodSelector value={period} onChange={setPeriod} />
            {backgroundSyncing && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-indigo/10 text-accent-indigo text-xs font-medium">
                <RefreshCw size={12} className="animate-spin" />
                Syncing...
              </div>
            )}
            <button
              onClick={handleSync}
              disabled={syncing || backgroundSyncing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-border-subtle transition-all text-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>
        )}
      </div>

      {/* ─── Connection gate ─── */}
      {!allConnected ? (
        <ServiceConnectionOverlay
          moduleName="Ad Manager"
          services={missingServices.map(({ service, meta }) => ({
            service,
            description: meta.description,
            onConnect: () => { window.location.href = `/settings?connect=${service}`; },
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
              {/* ─── First-sync prompt ─── */}
              {isFirstSync && adAccounts.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-accent-indigo/5 border border-accent-indigo/20">
                  <p className="text-sm font-medium text-text-primary mb-1">Select your ad accounts to get started</p>
                  <p className="text-xs text-text-secondary">
                    Choose which Meta ad accounts to track using the dropdown above, then click &quot;Sync Now&quot; to pull your campaign data.
                  </p>
                </div>
              )}

              {/* ─── Status Filter + Sync Status ─── */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  {([
                    { key: "live" as const, label: "Live", count: liveCount, active: "bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30" },
                    { key: "paused" as const, label: "Paused", count: pausedCount, active: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" },
                    { key: "all" as const, label: "All", count: accountFilteredCampaigns.length, active: "bg-accent-indigo/15 text-accent-indigo border-accent-indigo/30" },
                  ]).map(({ key, label, count, active }) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                        statusFilter === key
                          ? active
                          : "bg-white/[0.04] text-text-muted border-subtle hover:text-text-secondary hover:bg-white/[0.06]"
                      )}
                    >
                      {label}
                      {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {lastSynced && (
                    <span className="text-text-muted">
                      Last synced: {(() => {
                        const d = new Date(lastSynced);
                        const now = new Date();
                        const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
                        const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
                        return isToday ? `Today ${time}` : `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
                      })()}
                    </span>
                  )}
                  {syncError && (
                    <span className="text-accent-red">{syncError}</span>
                  )}
                </div>
              </div>

              {/* ─── Metric Cards (click to toggle currency) ─── */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <MetricCard
                  label="Total Spend"
                  value={swappedCards.has("spend") ? Math.round(toUsd(totals.spend)) : totals.spend}
                  format="currency"
                  currency={swappedCards.has("spend") ? "$" : currencySymbol}
                  subtitle={swappedCards.has("spend")
                    ? `${currencySymbol}${Math.round(totals.spend).toLocaleString("en-GB")} ${currencyCode}`
                    : `$${Math.round(toUsd(totals.spend)).toLocaleString("en-GB")} USD`
                  }
                  onClick={() => toggleCard("spend")}
                />
                <MetricCard
                  label="Revenue"
                  value={swappedCards.has("revenue") ? Math.round(toUsd(totals.revenue)) : totals.revenue}
                  format="currency"
                  currency={swappedCards.has("revenue") ? "$" : currencySymbol}
                  subtitle={swappedCards.has("revenue")
                    ? `${currencySymbol}${Math.round(totals.revenue).toLocaleString("en-GB")} ${currencyCode}`
                    : `$${Math.round(toUsd(totals.revenue)).toLocaleString("en-GB")} USD`
                  }
                  onClick={() => toggleCard("revenue")}
                />
                <MetricCard
                  label="Profit"
                  value={swappedCards.has("profit") ? Math.round(toUsd(totals.profit)) : totals.profit}
                  format="currency"
                  currency={swappedCards.has("profit") ? "$" : currencySymbol}
                  subtitle={swappedCards.has("profit")
                    ? `${currencySymbol}${Math.round(totals.profit).toLocaleString("en-GB")} ${currencyCode}`
                    : `$${Math.round(toUsd(totals.profit)).toLocaleString("en-GB")} USD`
                  }
                  onClick={() => toggleCard("profit")}
                />
                <MetricCard label="Orders" value={totals.orders} format="number" />
                <MetricCard
                  label="Avg ROAS"
                  value={totals.roas}
                  format="number"
                  className="col-span-2 lg:col-span-1"
                />
              </div>

              {/* ─── Empty state ─── */}
              {filteredCampaigns.length === 0 && !syncing && (
                <div className="text-center py-16 text-text-muted">
                  <p className="text-lg font-medium mb-2">
                    {accountFilteredCampaigns.length === 0 ? "No campaigns found" : `No ${statusFilter} campaigns`}
                  </p>
                  <p className="text-sm">
                    {accountFilteredCampaigns.length === 0
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
