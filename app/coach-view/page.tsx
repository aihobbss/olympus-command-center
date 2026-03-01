"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  X,
  Eye,
  UserPlus,
  Check,
  ShieldCheck,
  Lock,
  TrendingUp,
  BarChart3,
  ShoppingBag,
} from "lucide-react";
import { MetricCard, TimePeriodSelector, StatusBadge } from "@/components/ui";
import type { TimePeriod } from "@/components/ui";
import { studentStores, type StudentStore } from "@/data/mock";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────

const PERIOD_FACTOR: Record<TimePeriod, number> = {
  today: 0.14,
  "3d": 0.4,
  "7d": 1.0,
  "30d": 3.2,
  all: 5.5,
};

const STATUS_VARIANT: Record<StudentStore["status"], "success" | "warning" | "danger"> = {
  Active: "success",
  Struggling: "warning",
  "At Risk": "danger",
};

type AccessRequest = {
  id: string;
  studentName: string;
  storeName: string;
  requestedDate: string;
};

const MOCK_REQUESTS: AccessRequest[] = [
  {
    id: "ar-001",
    studentName: "Liam Cooper",
    storeName: "Atlas Street Co",
    requestedDate: "22 Feb 2026",
  },
  {
    id: "ar-002",
    studentName: "Aisha Patel",
    storeName: "Meridian Studio",
    requestedDate: "25 Feb 2026",
  },
];

// Newly approved stores that get added to table
const APPROVED_STORE_DATA: Record<string, Omit<StudentStore, "id" | "rank">> = {
  "ar-001": {
    storeName: "Atlas Street Co",
    owner: "Liam",
    revenue: 620,
    adSpend: 410,
    profit: 48,
    roas: 1.51,
    status: "Struggling",
  },
  "ar-002": {
    storeName: "Meridian Studio",
    owner: "Aisha",
    revenue: 140,
    adSpend: 190,
    profit: -95,
    roas: 0.74,
    status: "At Risk",
  },
};

// Mock dashboard sections for overlay
const OVERLAY_SECTIONS = [
  { icon: TrendingUp, label: "Profit Tracker", status: "3 profitable days this week" },
  { icon: BarChart3, label: "Ad Manager", status: "2 campaigns active" },
  { icon: ShoppingBag, label: "Products", status: "4 products live" },
];

// ─── Page ───────────────────────────────────────────────────

export default function CoachViewPage() {
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [overlayStore, setOverlayStore] = useState<StudentStore | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [deniedIds, setDeniedIds] = useState<Set<string>>(new Set());

  // ── Merge approved stores into the main list ──

  const allStores = useMemo(() => {
    const approved = Array.from(approvedIds)
      .filter((id) => APPROVED_STORE_DATA[id])
      .map((id, idx) => ({
        id,
        rank: studentStores.length + idx + 1,
        ...APPROVED_STORE_DATA[id],
      }));
    return [...studentStores, ...approved];
  }, [approvedIds]);

  // ── Scale by period ──

  const scaledStores = useMemo(() => {
    const f = PERIOD_FACTOR[period];
    return allStores
      .map((s) => {
        const revenue = Math.round(s.revenue * f);
        const adSpend = Math.round(s.adSpend * f);
        const profit = Math.round(s.profit * f);
        const roas = adSpend > 0 ? parseFloat((revenue / adSpend).toFixed(2)) : 0;
        return { ...s, revenue, adSpend, profit, roas };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .map((s, idx) => ({ ...s, rank: idx + 1 }));
  }, [allStores, period]);

  // ── Aggregates ──

  const totals = useMemo(() => {
    let revenue = 0,
      adSpend = 0,
      profit = 0;
    for (const s of scaledStores) {
      revenue += s.revenue;
      adSpend += s.adSpend;
      profit += s.profit;
    }
    return { revenue, adSpend, profit, activeStudents: scaledStores.length };
  }, [scaledStores]);

  // ── Pending requests ──

  const pendingRequests = useMemo(
    () =>
      MOCK_REQUESTS.filter(
        (r) => !approvedIds.has(r.id) && !deniedIds.has(r.id)
      ),
    [approvedIds, deniedIds]
  );

  // ── Handlers ──

  const handleRowClick = useCallback(
    (store: StudentStore) => {
      setOverlayStore(store);
    },
    []
  );

  const handleApprove = useCallback((id: string) => {
    setApprovedIds((prev) => new Set(prev).add(id));
  }, []);

  const handleDeny = useCallback((id: string) => {
    setDeniedIds((prev) => new Set(prev).add(id));
  }, []);

  // ─── Render ───────────────────────────────────────────────

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
            <Users
              className="text-accent-indigo"
              size={20}
              strokeWidth={1.8}
            />
          </div>
          <div>
            <h1 className="text-2xl font-syne font-bold tracking-tight">
              Coach View
            </h1>
            <p className="text-sm text-text-secondary">
              Student store aggregation and performance overview
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Coach role badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-indigo/10 border border-accent-indigo/20">
            <ShieldCheck size={13} className="text-accent-indigo" />
            <span className="text-[11px] font-semibold text-accent-indigo">
              Coach Mode
            </span>
          </div>
          <TimePeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Total Student Revenue"
          value={totals.revenue}
          format="currency"
          currency="£"
        />
        <MetricCard
          label="Total Ad Spend"
          value={totals.adSpend}
          format="currency"
          currency="£"
        />
        <MetricCard
          label="Total Profit"
          value={totals.profit}
          format="currency"
          currency="£"
        />
        <MetricCard
          label="Active Students"
          value={totals.activeStudents}
          format="number"
        />
      </div>

      {/* ─── Student Table ─── */}
      <div className="overflow-x-auto rounded-xl border border-subtle bg-bg-card mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-center w-12">
                #
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-left">
                Store
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-left hidden sm:table-cell">
                Owner
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">
                Revenue
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right hidden md:table-cell">
                Ad Spend
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">
                Profit
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right hidden lg:table-cell">
                ROAS
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {scaledStores.map((store) => (
              <tr
                key={store.id}
                onClick={() => handleRowClick(store)}
                className="border-b border-subtle last:border-b-0 cursor-pointer hover:bg-white/[0.02] transition-colors duration-100"
              >
                <td className="px-4 py-3 text-center">
                  <span className="text-[12px] font-jetbrains text-text-muted tabular-nums">
                    {store.rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-text-primary">
                    {store.storeName}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-text-secondary">
                    {store.owner}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                  £{store.revenue.toLocaleString("en-GB")}
                </td>
                <td className="px-4 py-3 text-right font-jetbrains text-text-secondary tabular-nums hidden md:table-cell">
                  £{store.adSpend.toLocaleString("en-GB")}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-jetbrains font-medium tabular-nums",
                    store.profit >= 0
                      ? "text-accent-emerald"
                      : "text-accent-red"
                  )}
                >
                  {store.profit < 0 ? "-" : ""}£
                  {Math.abs(store.profit).toLocaleString("en-GB")}
                </td>
                <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums hidden lg:table-cell">
                  {store.roas.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge
                    status={store.status}
                    variant={STATUS_VARIANT[store.status]}
                    size="sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Access Requests ─── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={16} strokeWidth={1.8} className="text-text-muted" />
          <h2 className="text-base font-syne font-semibold text-text-primary">
            Access Requests
          </h2>
          {pendingRequests.length > 0 && (
            <span className="text-[10px] font-jetbrains font-semibold px-2 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber">
              {pendingRequests.length}
            </span>
          )}
        </div>

        {pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-subtle px-6 py-8 flex items-center justify-center">
            <p className="text-sm text-text-muted">
              No pending access requests
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent-amber/10 flex items-center justify-center shrink-0">
                    <UserPlus
                      size={16}
                      strokeWidth={1.8}
                      className="text-accent-amber"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {req.studentName}
                    </p>
                    <p className="text-[12px] text-text-secondary">
                      {req.storeName} &middot;{" "}
                      <span className="text-text-muted">
                        Requested {req.requestedDate}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25 transition-colors"
                  >
                    <Check size={13} strokeWidth={2.5} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(req.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors"
                  >
                    <X size={13} strokeWidth={2.5} />
                    Deny
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Full-screen Overlay ─── */}
      <AnimatePresence>
        {overlayStore && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 280,
            }}
            className="fixed inset-0 z-50 bg-bg-primary overflow-y-auto"
          >
            {/* Top banner */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-subtle glass">
              <div className="flex items-center gap-3">
                <Eye
                  size={16}
                  strokeWidth={1.8}
                  className="text-accent-indigo"
                />
                <span className="text-sm font-syne font-semibold text-text-primary">
                  Viewing: {overlayStore.storeName}
                </span>
                <span className="text-[10px] font-medium text-text-muted bg-white/[0.06] px-2 py-0.5 rounded-full">
                  Read-only
                </span>
              </div>
              <button
                onClick={() => setOverlayStore(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-white/[0.04] transition-colors"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Overlay content */}
            <div className="max-w-6xl mx-auto px-6 py-6">
              {/* Store header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
                  <ShoppingBag
                    size={18}
                    strokeWidth={1.8}
                    className="text-accent-indigo"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-syne font-bold tracking-tight text-text-primary">
                    {overlayStore.storeName}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    Owned by {overlayStore.owner}
                  </p>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <MetricCard
                  label="Revenue"
                  value={overlayStore.revenue}
                  format="currency"
                  currency="£"
                />
                <MetricCard
                  label="Ad Spend"
                  value={overlayStore.adSpend}
                  format="currency"
                  currency="£"
                />
                <MetricCard
                  label="Profit"
                  value={overlayStore.profit}
                  format="currency"
                  currency="£"
                />
                <MetricCard
                  label="ROAS"
                  value={overlayStore.roas}
                  format="number"
                />
              </div>

              {/* Module sections (read-only) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {OVERLAY_SECTIONS.map((section) => (
                  <div
                    key={section.label}
                    className="card p-5"
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <section.icon
                        size={16}
                        strokeWidth={1.8}
                        className="text-accent-indigo"
                      />
                      <h4 className="text-sm font-syne font-semibold text-text-primary">
                        {section.label}
                      </h4>
                    </div>
                    <p className="text-[12px] text-text-secondary mb-4">
                      {section.status}
                    </p>
                    {/* Disabled action button */}
                    <div className="relative group">
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-white/[0.03] text-text-muted cursor-not-allowed"
                      >
                        <Lock size={12} />
                        View Details
                      </button>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-subtle shadow-xl text-[11px] text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Read-only — collaborator access
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status + actions strip */}
              <div className="card p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={overlayStore.status}
                      variant={STATUS_VARIANT[overlayStore.status]}
                      size="md"
                    />
                    <span className="text-sm text-text-secondary">
                      {overlayStore.status === "Active"
                        ? "Store is performing well"
                        : overlayStore.status === "Struggling"
                          ? "Store needs attention — low margins"
                          : "Store at risk — negative profit"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative group">
                      <button
                        disabled
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-accent-indigo/10 text-text-muted cursor-not-allowed"
                      >
                        <Lock size={11} />
                        Scale Campaigns
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-subtle shadow-xl text-[11px] text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Read-only — collaborator access
                      </div>
                    </div>
                    <div className="relative group">
                      <button
                        disabled
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-accent-red/10 text-text-muted cursor-not-allowed"
                      >
                        <Lock size={11} />
                        Kill Campaigns
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-subtle shadow-xl text-[11px] text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Read-only — collaborator access
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
