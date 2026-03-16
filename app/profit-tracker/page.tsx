"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  RefreshCw,
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { MetricCard, TimePeriodSelector, EmptyState } from "@/components/ui";
import type { TimePeriod } from "@/components/ui";
import ProfitChart from "@/components/modules/ProfitChart";
import { PerAdCard } from "@/components/modules/PerAdCard";
import { ServiceConnectionOverlay } from "@/components/modules/ServiceConnectionCard";
import {
  type AdCampaign,
  type BudgetTierSnapshot,
  type ProfitLog,
} from "@/data/mock";
import { cn } from "@/lib/utils";
import { useStoreContext, useAuthStore, useConnectionsStore } from "@/lib/store";
import { SERVICE_REGISTRY } from "@/lib/services/connections";
import {
  fetchProfitLogs,
  fetchCogs,
  upsertCog,
  triggerProfitSync,
  getLastProfitSync,
} from "@/lib/services/profit-tracker";
import { fetchLiveCampaigns } from "@/lib/services/meta-campaigns";

// ─── Constants ──────────────────────────────────────────────

const STORE_TO_USD: Record<string, number> = { UK: 1.27, AU: 0.63 };

type View = "store-logs" | "per-ad";

const VIEW_OPTIONS: { key: View; label: string }[] = [
  { key: "store-logs", label: "Store Logs" },
  { key: "per-ad", label: "Per-Ad Breakdown" },
];

const PERIOD_LABEL: Record<TimePeriod, string> = {
  today: "Today",
  "3d": "3D",
  "7d": "7D",
  "30d": "30D",
  all: "All Time",
};

// ─── Helpers ────────────────────────────────────────────────

function fmtCurrency(value: number, currency: string, decimals = 0): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${value < 0 ? "-" : ""}${currency}${formatted}`;
}

function fmtDate(iso: string): string {
  // Parse YYYY-MM-DD as local date (not UTC) to avoid off-by-one timezone shift
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC interpretation) */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ─── Budget tier grouping types ─────────────────────────────

type TierEntry = {
  campaign: AdCampaign;
  snapshot: BudgetTierSnapshot;
  tierIndicator: "current" | "scaled";
  scaledToBudget?: number;
};

type TierGroup = {
  budgetPerDay: number;
  entries: TierEntry[];
};

// ─── Page ───────────────────────────────────────────────────

export default function ProfitTrackerPage() {
  const { selectedStore } = useStoreContext();
  const user = useAuthStore((s) => s.user);
  const { loadConnections, isConnected } = useConnectionsStore();

  useEffect(() => {
    if (user) loadConnections();
  }, [user, loadConnections]);

  const shopifyConnected = isConnected("shopify");
  const facebookConnected = isConnected("facebook");
  const allConnected = shopifyConnected && facebookConnected;

  const missingServices = [
    ...(!shopifyConnected
      ? [{ service: "shopify" as const, meta: SERVICE_REGISTRY.find((s) => s.id === "shopify")! }]
      : []),
    ...(!facebookConnected
      ? [{ service: "facebook" as const, meta: SERVICE_REGISTRY.find((s) => s.id === "facebook")! }]
      : []),
  ];

  const [view, setView] = useState<View>("store-logs");
  const [period, setPeriod] = useState<TimePeriod>("all");
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [cogs, setCogs] = useState<Record<string, number>>({});
  const [tableMonth, setTableMonth] = useState<Date>(() => new Date());
  const [profitLogs, setProfitLogs] = useState<ProfitLog[]>([]);
  const [liveCampaigns, setLiveCampaigns] = useState<AdCampaign[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  const storeCurrency = selectedStore?.currency ?? "";
  const ptRate = STORE_TO_USD[selectedStore?.market ?? ""] ?? 1;
  const currencyCode = selectedStore?.market === "UK" ? "GBP" : "AUD";
  // DB stores everything in USD — convert back to local for display
  const usdToLocal = useCallback(
    (usdAmount: number) => ptRate > 0 ? usdAmount / ptRate : usdAmount,
    [ptRate]
  );

  const storeId = selectedStore?.id ?? "";

  // ── Load real data from Supabase ──
  const loadData = useCallback(async () => {
    if (!storeId) return;

    const [logs, campaigns, cogData, lastSync] = await Promise.all([
      fetchProfitLogs(storeId),
      fetchLiveCampaigns(storeId),
      fetchCogs(storeId),
      getLastProfitSync(storeId),
    ]);

    setProfitLogs(logs);
    setLiveCampaigns(campaigns);
    setCogs(cogData);

    if (lastSync) setLastSynced(new Date(lastSync));
  }, [storeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const storeProfitLogs = profitLogs;
  const storeAdCampaigns = liveCampaigns;

  const filteredLogs = useMemo(() => {
    if (period === "all") return storeProfitLogs;
    const daysMap: Record<TimePeriod, number> = {
      today: 1,
      "3d": 3,
      "7d": 7,
      "30d": 30,
      all: Infinity,
    };
    const days = daysMap[period];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return storeProfitLogs.filter((log) => parseLocalDate(log.date) >= cutoff);
  }, [period, storeProfitLogs]);

  // ── Aggregated totals (from filtered logs) ──

  const totals = useMemo(() => {
    let revenue = 0,
      adSpend = 0,
      profit = 0;
    for (const log of filteredLogs) {
      revenue += log.revenue;
      adSpend += log.adSpend;
      profit += log.profit;
    }
    const roas =
      adSpend > 0 ? parseFloat((revenue / adSpend).toFixed(2)) : 0;
    return { revenue, adSpend, profit, roas };
  }, [filteredLogs]);

  // ── Month-filtered logs (feeds table) ──

  const monthLogs = useMemo(() => {
    const year = tableMonth.getFullYear();
    const month = tableMonth.getMonth();
    return storeProfitLogs.filter((log) => {
      const d = parseLocalDate(log.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [tableMonth, storeProfitLogs]);

  const monthTotals = useMemo(() => {
    let revenue = 0,
      cog = 0,
      adSpend = 0,
      transactionFee = 0,
      profit = 0;
    for (const log of monthLogs) {
      revenue += log.revenue;
      cog += log.cog;
      adSpend += log.adSpend;
      transactionFee += log.transactionFee;
      profit += log.profit;
    }
    const roas =
      adSpend > 0 ? parseFloat((revenue / adSpend).toFixed(2)) : 0;
    const profitPercent =
      revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0;
    return { revenue, cog, adSpend, transactionFee, profit, roas, profitPercent };
  }, [monthLogs]);

  const monthLabel = tableMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const goToPrevMonth = useCallback(() => {
    setTableMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setTableMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, []);

  // ── Budget tier groups (for per-ad breakdown) ──

  const budgetTierGroups = useMemo((): TierGroup[] => {
    const tierMap = new Map<number, TierEntry[]>();

    for (const campaign of storeAdCampaigns) {
      const history: BudgetTierSnapshot[] = campaign.budgetHistory ?? [
        {
          budgetPerDay: campaign.budget,
          status: "current",
          spend: campaign.spend,
          revenue: campaign.revenue,
          orders: campaign.orders,
          profit: campaign.profit,
          roas: campaign.roas,
          cpc: campaign.cpc,
          atc: campaign.atc,
        },
      ];

      const currentSnapshot = history.find((h) => h.status === "current");

      for (const snapshot of history) {
        const tier = snapshot.budgetPerDay;
        if (!tierMap.has(tier)) tierMap.set(tier, []);
        const isHistorical = snapshot.status === "historical";

        tierMap.get(tier)!.push({
          campaign,
          snapshot,
          tierIndicator: isHistorical ? "scaled" : "current",
          scaledToBudget: isHistorical
            ? currentSnapshot?.budgetPerDay
            : undefined,
        });
      }
    }

    return Array.from(tierMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([budgetPerDay, entries]) => ({ budgetPerDay, entries }));
  }, [storeAdCampaigns]);

  // ── Real sync ──

  const handleSync = useCallback(async () => {
    if (syncing || !user || !storeId) return;
    setSyncing(true);
    setSyncError(null);

    try {
      // First sync: pull full history. After that: just pull today (cron handles daily).
      const daysToSync = profitLogs.length === 0 ? 1095 : 1;

      // Use the same ad account selection saved by Ad Manager
      let selectedAccounts: string[] | undefined;
      try {
        const key = `ad-accounts-selection:${storeId}`;
        const saved = localStorage.getItem(key);
        console.log("[profit-sync] localStorage key:", key, "value:", saved);
        if (saved) {
          const ids: string[] = JSON.parse(saved);
          if (Array.isArray(ids) && ids.length > 0) {
            selectedAccounts = ids;
          }
        }
        console.log("[profit-sync] selectedAccounts:", selectedAccounts);
      } catch { /* ignore parse errors */ }

      const result = await triggerProfitSync(user.id, storeId, daysToSync, selectedAccounts);
      if (result.error) {
        setSyncError(result.error);
      } else {
        // synced === -1 means the request timed out but server may have written data
        await loadData();
        setLastSynced(new Date());
      }
    } catch (err) {
      setSyncError("Sync failed — check your connections and try again.");
      console.error("Profit sync error:", err);
    } finally {
      setSyncing(false);
    }
  }, [syncing, user, storeId, loadData]);

  // ── COG change (persisted to Supabase) ──

  const handleCogChange = useCallback((productName: string, newCog: number) => {
    setCogs((prev) => ({ ...prev, [productName]: newCog }));
    if (storeId) {
      upsertCog(storeId, productName, newCog);
    }
  }, [storeId]);

  // ── CSV export ──

  const handleExportCsv = useCallback(() => {
    if (storeProfitLogs.length === 0) return;
    const headers = ["Date", "Revenue", "COG", "Ad Spend", "Transaction Fee", "Profit", "ROAS", "Profit %"];
    const rows = storeProfitLogs.map((log) => [
      log.date,
      log.revenue,
      log.cog,
      log.adSpend,
      log.transactionFee,
      log.profit,
      log.roas,
      log.profitPercent,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-tracker-${selectedStore?.name?.replace(/\s+/g, "-").toLowerCase() || "store"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [storeProfitLogs, selectedStore]);

  // ── Last synced label ──

  const syncLabel = useMemo(() => {
    if (!lastSynced) return "Never";
    const now = new Date();
    const isToday = lastSynced.getFullYear() === now.getFullYear() && lastSynced.getMonth() === now.getMonth() && lastSynced.getDate() === now.getDate();
    const time = lastSynced
      .toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toUpperCase();
    if (isToday) return `Today ${time}`;
    return `${lastSynced.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
  }, [lastSynced]);

  // ── Chart title ──

  const chartTitle = `Revenue vs Profit — ${PERIOD_LABEL[period]}`;

  if (!selectedStore) return null;

  // ── Connection gating ──
  if (!allConnected) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 flex items-center justify-center">
            <TrendingUp className="text-accent-emerald" size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-syne font-bold tracking-tight">
              Profit Tracker
            </h1>
            <p className="text-sm text-text-secondary">
              Daily P&amp;L, ROAS, and per-product breakdown
            </p>
          </div>
        </div>
        <ServiceConnectionOverlay
          moduleName="Profit Tracker"
          services={missingServices.map(({ service, meta }) => ({
            service,
            description: meta.description,
            onConnect: () => { window.location.href = `/settings?connect=${service}`; },
          }))}
        />
      </div>
    );
  }

  // ── Empty state when no data ──
  const hasData = storeProfitLogs.length > 0;

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 flex items-center justify-center">
            <TrendingUp
              className="text-accent-emerald"
              size={20}
              strokeWidth={1.8}
            />
          </div>
          <div>
            <h1 className="text-2xl font-syne font-bold tracking-tight">
              Profit Tracker
            </h1>
            <p className="text-sm text-text-secondary">
              Daily P&amp;L, ROAS, and per-product breakdown
            </p>
          </div>
        </div>

        {/* Sync status + button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-jetbrains">
            <Clock size={12} strokeWidth={1.8} />
            Last synced: {syncLabel}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              syncing
                ? "bg-accent-emerald/20 text-accent-emerald cursor-not-allowed"
                : "bg-accent-emerald hover:bg-accent-emerald/80 text-white shadow-lg shadow-accent-emerald/20"
            )}
          >
            {syncing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={13} />
                Sync Now
              </>
            )}
          </button>
          {hasData && (
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] border border-subtle transition-all duration-200"
            >
              <Download size={13} />
              CSV
            </button>
          )}
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="No profit data yet"
          description="Click Sync Now to pull data from Shopify and Meta."
        />
      ) : (
      <>

      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
        <MetricCard
          label="Total Revenue"
          value={Math.round(usdToLocal(totals.revenue))}
          format="currency"
          currency={storeCurrency}
          subtitle={`$${Math.round(totals.revenue).toLocaleString("en-GB")} USD`}
        />
        <MetricCard
          label="Total Ad Spend"
          value={Math.round(totals.adSpend)}
          format="currency"
          currency="$"
          subtitle={`${fmtCurrency(Math.round(usdToLocal(totals.adSpend)), storeCurrency)} ${currencyCode}`}
        />
        <MetricCard
          label="Net Profit"
          value={Math.round(totals.profit)}
          format="currency"
          currency="$"
          subtitle={`${fmtCurrency(Math.round(usdToLocal(totals.profit)), storeCurrency)} ${currencyCode}`}
        />
        <MetricCard
          label="Blended ROAS"
          value={totals.roas}
          format="number"
        />
      </div>

      {/* Currency rate note + status */}
      <div className="flex items-center justify-between mb-6 pl-1">
        <p className="text-[10px] text-text-muted">
          Displaying in {currencyCode} ({storeCurrency}) · {storeCurrency}1 ≈ $
          {ptRate.toFixed(2)} USD
        </p>
        <div className="flex items-center gap-3 text-[10px]">
          {syncError && (
            <span className="text-accent-red">{syncError}</span>
          )}
        </div>
      </div>

      {/* ─── View Toggle + Time Period Selector ─── */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-1 border border-subtle">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              className={cn(
                "relative px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors duration-150",
                view === opt.key
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {view === opt.key && (
                <motion.div
                  layoutId="profit-view-pill"
                  className="absolute inset-0 rounded-md bg-accent-emerald/15 ring-1 ring-accent-emerald/25"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10">{opt.label}</span>
            </button>
          ))}
        </div>
        <TimePeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ─── Store Logs View ─── */}
      {view === "store-logs" && (
        <>
          {/* Chart */}
          <div className="mb-6">
            <ProfitChart
              logs={filteredLogs.map((log) => ({
                ...log,
                revenue: usdToLocal(log.revenue),
                profit: usdToLocal(log.profit),
              }))}
              currency={storeCurrency}
              title={chartTitle}
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-subtle bg-bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-subtle">
                  {[
                    "Date",
                    "Revenue",
                    "COG",
                    "Ad Spend",
                    "Transaction",
                    "Profit",
                    "ROAS",
                    "Profit %",
                  ].map((col) => (
                    <th
                      key={col}
                      className={cn(
                        "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted",
                        col === "Date" ? "text-left" : "text-right"
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthLogs.map((log) => (
                  <tr
                    key={log.date}
                    className="border-b border-subtle last:border-b-0 transition-colors duration-100 hover:bg-white/[0.01]"
                  >
                    <td className="px-4 py-3 text-text-primary font-medium whitespace-nowrap">
                      {fmtDate(log.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                      {fmtCurrency(Math.round(usdToLocal(log.revenue)), storeCurrency)}
                    </td>
                    <td className="px-4 py-3 text-right font-jetbrains text-text-secondary tabular-nums">
                      {fmtCurrency(Math.round(log.cog), "$")}
                    </td>
                    <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                      {fmtCurrency(Math.round(log.adSpend), "$")}
                    </td>
                    <td className="px-4 py-3 text-right font-jetbrains text-text-secondary tabular-nums">
                      {fmtCurrency(log.transactionFee, "$", 2)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-jetbrains font-medium tabular-nums",
                        log.profit >= 0
                          ? "text-accent-emerald"
                          : "text-accent-red"
                      )}
                    >
                      {fmtCurrency(log.profit, "$", 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                      {log.roas.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-jetbrains font-medium tabular-nums",
                        log.profitPercent >= 0
                          ? "text-accent-emerald"
                          : "text-accent-red"
                      )}
                    >
                      {log.profitPercent > 0 ? "+" : ""}
                      {log.profitPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Monthly totals */}
              <tfoot>
                <tr className="border-t-2 border-subtle bg-white/[0.02]">
                  <td className="px-4 py-3 text-text-primary font-syne font-semibold text-sm">
                    {monthLabel} Total
                  </td>
                  <td className="px-4 py-3 text-right font-jetbrains text-text-primary font-semibold tabular-nums">
                    {fmtCurrency(Math.round(usdToLocal(monthTotals.revenue)), storeCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right font-jetbrains text-text-secondary font-semibold tabular-nums">
                    {fmtCurrency(Math.round(monthTotals.cog), "$")}
                  </td>
                  <td className="px-4 py-3 text-right font-jetbrains text-text-primary font-semibold tabular-nums">
                    {fmtCurrency(Math.round(monthTotals.adSpend), "$")}
                  </td>
                  <td className="px-4 py-3 text-right font-jetbrains text-text-secondary font-semibold tabular-nums">
                    {fmtCurrency(monthTotals.transactionFee, "$", 2)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-jetbrains font-semibold tabular-nums",
                      monthTotals.profit >= 0
                        ? "text-accent-emerald"
                        : "text-accent-red"
                    )}
                  >
                    {fmtCurrency(monthTotals.profit, "$", 2)}
                  </td>
                  <td className="px-4 py-3 text-right font-jetbrains text-text-primary font-semibold tabular-nums">
                    {monthTotals.roas.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-jetbrains font-semibold tabular-nums",
                      monthTotals.profitPercent >= 0
                        ? "text-accent-emerald"
                        : "text-accent-red"
                    )}
                  >
                    {monthTotals.profitPercent > 0 ? "+" : ""}
                    {monthTotals.profitPercent.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-syne font-semibold text-text-primary min-w-[160px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* ─── Per-Ad Breakdown View ─── */}
      {view === "per-ad" && (
        <div className="space-y-6">
          {budgetTierGroups.map((group) => (
            <div key={group.budgetPerDay}>
              {/* Tier Section Header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-syne font-semibold text-accent-indigo font-jetbrains whitespace-nowrap">
                  ${group.budgetPerDay}/day
                </span>
                <span className="h-px flex-1 bg-[var(--border-subtle)]" />
              </div>

              {/* Campaign Cards in this Tier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {group.entries.map((entry, idx) => {
                  const snapshotCampaign: AdCampaign = {
                    ...entry.campaign,
                    spend: entry.snapshot.spend,
                    revenue: entry.snapshot.revenue,
                    orders: entry.snapshot.orders,
                    profit: entry.snapshot.profit,
                    roas: entry.snapshot.roas,
                    cpc: entry.snapshot.cpc,
                    atc: entry.snapshot.atc,
                    budget: entry.snapshot.budgetPerDay,
                  };

                  return (
                    <PerAdCard
                      key={`${entry.campaign.id}-${entry.snapshot.budgetPerDay}-${idx}`}
                      campaign={snapshotCampaign}
                      cog={cogs[entry.campaign.id] ?? 0}
                      onCogChange={handleCogChange}
                      storeCurrency={storeCurrency}
                      market={selectedStore.market}
                      toLocal={usdToLocal}
                      tierIndicator={entry.tierIndicator}
                      scaledToBudget={entry.scaledToBudget}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
