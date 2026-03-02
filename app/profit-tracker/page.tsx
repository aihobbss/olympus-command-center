"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  RefreshCw,
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { MetricCard, TimePeriodSelector } from "@/components/ui";
import type { TimePeriod } from "@/components/ui";
import ProfitChart from "@/components/modules/ProfitChart";
import { PerAdCard } from "@/components/modules/PerAdCard";
import {
  profitLogs,
  adCampaigns,
  type AdCampaign,
  type BudgetTierSnapshot,
} from "@/data/mock";
import { cn } from "@/lib/utils";
import { useStoreContext } from "@/lib/store";

// ─── Constants ──────────────────────────────────────────────

const STORE_TO_USD: Record<string, number> = { UK: 1.27, AU: 0.63 };

type View = "store-logs" | "per-ad";

const VIEW_OPTIONS: { key: View; label: string }[] = [
  { key: "store-logs", label: "Store Logs" },
  { key: "per-ad", label: "Per-Ad Breakdown" },
];

const DEFAULT_COGS: Record<string, number> = {
  "ac-001": 16.0,
  "ac-002": 15.0,
  "ac-003": 20.0,
  "ac-004": 12.0,
};

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
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
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
  const [view, setView] = useState<View>("store-logs");
  const [period, setPeriod] = useState<TimePeriod>("all");
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(() => new Date());
  const [cogs, setCogs] = useState<Record<string, number>>(DEFAULT_COGS);
  const [tableMonth, setTableMonth] = useState<Date>(() => new Date());

  const { selectedStore } = useStoreContext();
  const storeCurrency = selectedStore.currency;
  const ptRate = STORE_TO_USD[selectedStore.market] ?? 1;
  const currencyCode = selectedStore.market === "UK" ? "GBP" : "AUD";
  const convertToUsd = useCallback(
    (localAmount: number) => Math.round(localAmount * ptRate),
    [ptRate]
  );

  // ── Time-filtered logs (feeds metric cards + chart) ──

  const filteredLogs = useMemo(() => {
    if (period === "all") return profitLogs;
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
    return profitLogs.filter((log) => new Date(log.date) >= cutoff);
  }, [period]);

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
    return profitLogs.filter((log) => {
      const d = new Date(log.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [tableMonth]);

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

    for (const campaign of adCampaigns) {
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
  }, []);

  // ── Sync simulation ──

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 2000));
    setLastSynced(new Date());
    setSyncing(false);
  }, [syncing]);

  // ── COG change ──

  const handleCogChange = useCallback((id: string, newCog: number) => {
    setCogs((prev) => ({ ...prev, [id]: newCog }));
  }, []);

  // ── Last synced label ──

  const syncLabel = useMemo(() => {
    return `Today ${lastSynced
      .toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toUpperCase()}`;
  }, [lastSynced]);

  // ── Chart title ──

  const chartTitle = `Revenue vs Profit — ${PERIOD_LABEL[period]}`;

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
        </div>
      </div>

      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
        <MetricCard
          label="Total Revenue"
          value={totals.revenue}
          format="currency"
          currency={storeCurrency}
          subtitle={`$${convertToUsd(totals.revenue).toLocaleString("en-GB")} USD`}
        />
        <MetricCard
          label="Total Ad Spend"
          value={convertToUsd(totals.adSpend)}
          format="currency"
          currency="$"
          subtitle={`${fmtCurrency(totals.adSpend, storeCurrency)} ${currencyCode}`}
        />
        <MetricCard
          label="Net Profit"
          value={convertToUsd(totals.profit)}
          format="currency"
          currency="$"
          subtitle={`${fmtCurrency(totals.profit, storeCurrency)} ${currencyCode}`}
        />
        <MetricCard
          label="Blended ROAS"
          value={totals.roas}
          format="number"
        />
      </div>

      {/* Currency rate note */}
      <p className="text-[10px] text-text-muted mb-6 pl-1">
        Displaying in {currencyCode} ({storeCurrency}) · {storeCurrency}1 ≈ $
        {ptRate.toFixed(2)} USD
      </p>

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
              logs={filteredLogs}
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
                      {fmtCurrency(log.revenue, storeCurrency)}
                    </td>
                    <td className="px-4 py-3 text-right font-jetbrains text-text-secondary tabular-nums">
                      {fmtCurrency(convertToUsd(log.cog), "$")}
                    </td>
                    <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                      {fmtCurrency(convertToUsd(log.adSpend), "$")}
                    </td>
                    <td className="px-4 py-3 text-right font-jetbrains text-text-secondary tabular-nums">
                      {fmtCurrency(convertToUsd(log.transactionFee), "$", 2)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-jetbrains font-medium tabular-nums",
                        log.profit >= 0
                          ? "text-accent-emerald"
                          : "text-accent-red"
                      )}
                    >
                      {fmtCurrency(convertToUsd(log.profit), "$", 2)}
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
                    {fmtCurrency(monthTotals.revenue, storeCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right font-jetbrains text-text-secondary font-semibold tabular-nums">
                    {fmtCurrency(convertToUsd(monthTotals.cog), "$")}
                  </td>
                  <td className="px-4 py-3 text-right font-jetbrains text-text-primary font-semibold tabular-nums">
                    {fmtCurrency(convertToUsd(monthTotals.adSpend), "$")}
                  </td>
                  <td className="px-4 py-3 text-right font-jetbrains text-text-secondary font-semibold tabular-nums">
                    {fmtCurrency(convertToUsd(monthTotals.transactionFee), "$", 2)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-jetbrains font-semibold tabular-nums",
                      monthTotals.profit >= 0
                        ? "text-accent-emerald"
                        : "text-accent-red"
                    )}
                  >
                    {fmtCurrency(convertToUsd(monthTotals.profit), "$", 2)}
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
                      toUsd={convertToUsd}
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
    </div>
  );
}
