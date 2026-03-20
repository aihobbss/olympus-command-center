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
} from "@/lib/services/meta-campaigns";
import { fetchProfitLogsByDateRange, triggerProfitSync } from "@/lib/services/profit-tracker";
import { fetchAdAccounts, discoverAdAccounts, type UserAdAccount } from "@/lib/services/ad-accounts";

type AdTab = "live" | "creator";

// ─── Exchange rates (store currency → USD) ─────────────────
const STORE_TO_USD: Record<string, number> = { UK: 1.27, AU: 0.63 };

// ─── Cache staleness threshold (2 minutes) ─────────────────
const CACHE_TTL_MS = 2 * 60 * 1000;

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
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"live" | "paused" | "all">("live");
  const [shopifyTotals, setShopifyTotals] = useState({ revenue: 0, orders: 0, profit: 0 });
  // All profit logs loaded from Supabase (unfiltered) — used for local period filtering
  const [allProfitLogs, setAllProfitLogs] = useState<{ date: string; revenue: number; orders?: number; profit: number }[]>([]);

  const storeId = selectedStore?.id ?? "";
  // Track which store we've loaded cached data for, to avoid redundant fetches
  const loadedStoreRef = useRef<string | null>(null);

  // ── Ad account switcher state (multi-select, persisted per store) ──
  const [adAccounts, setAdAccounts] = useState<UserAdAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set()); // empty = all
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  // Restore saved selection from localStorage when storeId changes
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

  // Persist selection to localStorage whenever it changes
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
    // If all are now selected, reset to empty (= "all")
    updateSelection(next.size === adAccounts.length ? new Set() : next);
  }, [selectedAccountIds, adAccounts.length, updateSelection]);

  const toggleAll = useCallback(() => {
    updateSelection(new Set()); // empty = all
  }, [updateSelection]);

  const storeCurrency = selectedStore?.currency ?? "";
  const rate = STORE_TO_USD[selectedStore?.market ?? ""] ?? 1;
  const currencySymbol = storeCurrency === "AUD" ? "A$" : storeCurrency === "GBP" ? "£" : "$";
  const toUsd = useCallback(
    (localAmount: number) => Math.round(localAmount * rate),
    [rate]
  );
  // Convert USD back to store currency for display
  const usdToLocal = useCallback(
    (usdAmount: number) => rate > 0 ? Math.round(usdAmount / rate) : usdAmount,
    [rate]
  );

  // ── Load ad accounts (discover from Meta to get real names + all accounts) ──
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

  // ── Map period to Meta date_preset + days back for profit sync ──
  const DATE_PRESET: Record<TimePeriod, string> = {
    today: "today",
    "3d": "last_3d",
    "7d": "last_7d",
    "30d": "last_30d",
    all: "maximum",
  };
  const DAYS_BACK: Record<TimePeriod, number> = {
    today: 1,
    "3d": 3,
    "7d": 7,
    "30d": 30,
    all: 3650,
  };

  // Helper: compute date range string for the selected period
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

  // ── Load cached data from Supabase (no external API calls) ──
  // Fetches all campaigns and the widest profit log range ("all") so period changes can filter locally
  const loadCachedData = useCallback(async () => {
    if (!storeId) return;
    // Fetch all profit logs (widest range) so we can filter locally for any period
    const [data, profitLogs, synced] = await Promise.all([
      fetchLiveCampaigns(storeId),
      fetchProfitLogsByDateRange(storeId, "2000-01-01", new Date().toISOString().split("T")[0]),
      getLastSyncedAt(storeId),
    ]);
    const withRecs = data.map((c) => {
      const { status, recommendation } = computeRecommendation(c);
      return { ...c, status, recommendation };
    });
    setCampaigns(withRecs);
    setLastSynced(synced);
    setAllProfitLogs(profitLogs);
  }, [storeId]);

  // ── Compute shopifyTotals from allProfitLogs filtered by the current period ──
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

  // ── Background sync: pull fresh data from Meta + Shopify, then reload cache ──
  const runBackgroundSync = useCallback(async () => {
    if (!user || !storeId) return;
    setBackgroundSyncing(true);
    setSyncError(null);
    try {
      // Cap sync to 30 days to stay within Vercel 10s timeout
      const syncDays = Math.min(DAYS_BACK[period], 30);
      const results = await Promise.allSettled([
        triggerMetaSync(user.id, storeId, DATE_PRESET[period]),
        triggerProfitSync(user.id, storeId, syncDays),
      ]);
      if (results[0].status === "fulfilled" && results[0].value.error) {
        setSyncError(results[0].value.error);
      } else if (results[0].status === "rejected") {
        setSyncError("Meta sync failed — check your connection");
      }
      // Reload cached data from Supabase after sync
      await loadCachedData();
    } catch {
      setSyncError("Sync failed — check your connections in Settings");
      try { await loadCachedData(); } catch { /* ignore reload errors */ }
    } finally {
      setBackgroundSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, storeId, period, loadCachedData]);

  // ── Manual "Sync Now": always triggers a fresh Meta API call ──
  const handleSync = useCallback(async () => {
    if (!user || !storeId) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const syncDays = Math.min(DAYS_BACK[period], 30);
      const results = await Promise.allSettled([
        triggerMetaSync(user.id, storeId, DATE_PRESET[period]),
        triggerProfitSync(user.id, storeId, syncDays),
      ]);
      if (results[0].status === "fulfilled" && results[0].value.error) {
        setSyncError(results[0].value.error);
      } else if (results[0].status === "rejected") {
        setSyncError("Meta sync failed — check your connection");
      }
      await loadCachedData();
    } catch {
      setSyncError("Sync failed — check your connections in Settings");
      try { await loadCachedData(); } catch { /* ignore reload errors */ }
    } finally {
      setSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, storeId, period, loadCachedData]);

  // ── Cache-first load on page mount / store change ──
  // 1. Show cached data from Supabase immediately
  // 2. If last sync was >2 minutes ago, trigger a non-blocking background sync
  useEffect(() => {
    if (!metaConnected || !user || !storeId) return;
    // Avoid redundant loads for the same store
    if (loadedStoreRef.current === storeId) return;
    loadedStoreRef.current = storeId;

    let cancelled = false;

    (async () => {
      // Step 1: Load cached data immediately (fast — Supabase only)
      await loadCachedData();
      if (cancelled) return;

      // Step 2: Check cache staleness — sync in background if stale
      const syncedAt = await getLastSyncedAt(storeId);
      if (cancelled) return;

      const isStale = !syncedAt || (Date.now() - new Date(syncedAt).getTime() > CACHE_TTL_MS);
      if (isStale) {
        // Non-blocking background sync
        runBackgroundSync();
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaConnected, user, storeId]);

  // ── Period changes: filter locally from cached data, do NOT re-sync from Meta ──
  // shopifyTotals are recomputed via the useEffect above when `period` changes.
  // Campaigns are not date-filtered (they represent current state), so no action needed.

  // ── Filter campaigns by account + status ──
  const isLive = (c: AdCampaign) => c.campaignStatus === "Active" || c.campaignStatus === "Scaling";

  // First filter by selected ad accounts (empty set = all)
  const accountFilteredCampaigns = useMemo(() => {
    if (allSelected) return campaigns;
    return campaigns.filter((c) => c.adAccountId && selectedAccountIds.has(c.adAccountId));
  }, [campaigns, selectedAccountIds, allSelected]);

  // Then filter by status
  const filteredCampaigns = useMemo(() => {
    if (statusFilter === "all") return accountFilteredCampaigns;
    if (statusFilter === "live") return accountFilteredCampaigns.filter(isLive);
    return accountFilteredCampaigns.filter((c) => !isLive(c));
  }, [accountFilteredCampaigns, statusFilter]);

  const liveCount = useMemo(() => accountFilteredCampaigns.filter(isLive).length, [accountFilteredCampaigns]);
  const pausedCount = accountFilteredCampaigns.length - liveCount;

  // ── Aggregated metrics ──

  // Total ad spend from account-filtered campaigns (spend depends on selected account)
  const totalSpend = useMemo(() => {
    let spend = 0;
    for (const c of accountFilteredCampaigns) spend += c.spend;
    return spend;
  }, [accountFilteredCampaigns]);

  // Revenue, Orders, Profit come from Shopify profit logs (store-wide, NOT filtered by ad account)
  const totals = useMemo(() => {
    const roas = totalSpend > 0 ? parseFloat((shopifyTotals.revenue / totalSpend).toFixed(2)) : 0;
    return { spend: totalSpend, revenue: shopifyTotals.revenue, profit: shopifyTotals.profit, orders: shopifyTotals.orders, roas };
  }, [totalSpend, shopifyTotals]);

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

  // Selected account label for the switcher
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
                      {/* All Accounts toggle */}
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
                      {/* Individual accounts */}
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

      {/* ─── Connection gate — require both Meta + Shopify ─── */}
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
                  value={usdToLocal(totals.revenue)}
                  format="currency"
                  currency={currencySymbol}
                  subtitle={`$${Math.round(totals.revenue).toLocaleString()} USD`}
                />
                <MetricCard
                  label="Profit"
                  value={totals.profit}
                  format="currency"
                  currency="$"
                  subtitle={`${currencySymbol}${Math.round(usdToLocal(totals.profit)).toLocaleString()} ${storeCurrency}`}
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
