"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  RefreshCw,
  Loader2,
  Clock,
} from "lucide-react";
import { MetricCard } from "@/components/ui";
import ProfitChart from "@/components/modules/ProfitChart";
import { PerAdCard } from "@/components/modules/PerAdCard";
import { profitLogs, adCampaigns } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useStoreContext } from "@/lib/store";

// ─── Constants ──────────────────────────────────────────────

const GBP_TO_USD = 1.27;
const STORE_TO_USD: Record<string, number> = { UK: 1.27, AU: 0.63 };

type View = "store-logs" | "per-ad";

const VIEW_OPTIONS: { key: View; label: string }[] = [
  { key: "store-logs", label: "Store Logs" },
  { key: "per-ad", label: "Per-Ad Breakdown" },
];

// Default per-unit COG values for each campaign
const DEFAULT_COGS: Record<string, number> = {
  "ac-001": 16.0,
  "ac-002": 15.0,
  "ac-003": 20.0,
  "ac-004": 12.0,
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

function toUsd(gbp: number): string {
  const usd = Math.round(gbp * GBP_TO_USD);
  return `$${Math.abs(usd).toLocaleString("en-GB")}`;
}

// ─── Page ───────────────────────────────────────────────────

export default function ProfitTrackerPage() {
  const [view, setView] = useState<View>("store-logs");
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(() => new Date());
  const [cogs, setCogs] = useState<Record<string, number>>(DEFAULT_COGS);

  const { selectedStore } = useStoreContext();
  const storeCurrency = selectedStore.currency;
  const ptRate = STORE_TO_USD[selectedStore.market] ?? 1;
  const toUsd = useCallback(
    (localAmount: number) => Math.round(localAmount * ptRate),
    [ptRate]
  );

  // ── Aggregated totals ──

  const totals = useMemo(() => {
    let revenue = 0,
      adSpend = 0,
      profit = 0;
    for (const log of profitLogs) {
      revenue += log.revenue;
      adSpend += log.adSpend;
      profit += log.profit;
    }
    const roas =
      adSpend > 0 ? parseFloat((revenue / adSpend).toFixed(2)) : 0;
    return { revenue, adSpend, profit, roas };
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
        <div>
          <MetricCard
            label="Total Revenue"
            value={totals.revenue}
            format="currency"
            currency="£"
          />
          <p className="text-[10px] text-text-muted font-jetbrains px-5 mt-1 tabular-nums">
            ≈ {toUsd(totals.revenue)} USD
          </p>
        </div>
        <div>
          <MetricCard
            label="Total Ad Spend"
            value={totals.adSpend}
            format="currency"
            currency="£"
          />
          <p className="text-[10px] text-text-muted font-jetbrains px-5 mt-1 tabular-nums">
            ≈ {toUsd(totals.adSpend)} USD
          </p>
        </div>
        <div>
          <MetricCard
            label="Net Profit"
            value={totals.profit}
            format="currency"
            currency="£"
          />
          <p className="text-[10px] text-text-muted font-jetbrains px-5 mt-1 tabular-nums">
            ≈ {toUsd(totals.profit)} USD
          </p>
        </div>
        <div>
          <MetricCard
            label="Blended ROAS"
            value={totals.roas}
            format="number"
          />
        </div>
      </div>

      {/* Currency rate note */}
      <p className="text-[10px] text-text-muted mb-6 pl-1">
        Displaying in GBP (£) · £1 ≈ $1.27 USD
      </p>

      {/* ─── View Toggle ─── */}
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
      </div>

      {/* ─── Store Logs View ─── */}
      {view === "store-logs" && (
        <>
          {/* Chart */}
          <div className="mb-6">
            <ProfitChart logs={profitLogs} currency="£" />
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
                {profitLogs.map((log) => (
                  <tr
                    key={log.date}
                    className="border-b border-subtle last:border-b-0 transition-colors duration-100 hover:bg-white/[0.01]"
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-text-primary font-medium whitespace-nowrap">
                      {fmtDate(log.date)}
                    </td>
                    {/* Revenue */}
                    <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                      {fmtCurrency(log.revenue, "£")}
                    </td>
                    {/* COG */}
                    <td className="px-4 py-3 text-right font-jetbrains text-text-secondary tabular-nums">
                      {fmtCurrency(log.cog, "£")}
                    </td>
                    {/* Ad Spend */}
                    <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                      {fmtCurrency(log.adSpend, "£")}
                    </td>
                    {/* Transaction Fee */}
                    <td className="px-4 py-3 text-right font-jetbrains text-text-secondary tabular-nums">
                      {fmtCurrency(log.transactionFee, "£", 2)}
                    </td>
                    {/* Profit */}
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-jetbrains font-medium tabular-nums",
                        log.profit >= 0
                          ? "text-accent-emerald"
                          : "text-accent-red"
                      )}
                    >
                      {fmtCurrency(log.profit, "£", 2)}
                    </td>
                    {/* ROAS */}
                    <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                      {log.roas.toFixed(2)}
                    </td>
                    {/* Profit % */}
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
            </table>
          </div>
        </>
      )}

      {/* ─── Per-Ad Breakdown View ─── */}
      {view === "per-ad" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {adCampaigns.map((campaign) => (
            <PerAdCard
              key={campaign.id}
              campaign={campaign}
              cog={cogs[campaign.id] ?? 0}
              onCogChange={handleCogChange}
              storeCurrency={storeCurrency}
              toUsd={toUsd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
