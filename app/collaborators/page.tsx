"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Check,
  X,
  UserPlus,
  Send,
  Eye,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  ArrowLeft,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { MetricCard, StatusBadge, ConfirmModal, TimePeriodSelector } from "@/components/ui";
import type { TimePeriod } from "@/components/ui";
import {
  INCOMING_COLLAB_REQUESTS,
  MY_COLLAB_ACCESS,
  SENT_COLLAB_REQUESTS,
  USER_STORE_IDS,
  type CollabRequest,
  type CollabAccess,
  type SentCollabRequest,
} from "@/data/mock";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────

type CollabTab = "manage" | "view-stores";

const TAB_OPTIONS: { key: CollabTab; label: string }[] = [
  { key: "manage", label: "Manage Collaborators" },
  { key: "view-stores", label: "View Stores" },
];

const STATUS_VARIANT: Record<
  CollabAccess["status"],
  "success" | "warning" | "danger"
> = {
  Active: "success",
  Struggling: "warning",
  "At Risk": "danger",
};

const SENT_STATUS_STYLE: Record<
  SentCollabRequest["status"],
  { bg: string; text: string; label: string }
> = {
  pending: {
    bg: "bg-accent-amber/10",
    text: "text-accent-amber",
    label: "Pending",
  },
  approved: {
    bg: "bg-accent-emerald/10",
    text: "text-accent-emerald",
    label: "Approved",
  },
  denied: {
    bg: "bg-accent-red/10",
    text: "text-accent-red",
    label: "Denied",
  },
};

const PERIOD_FACTOR: Record<TimePeriod, number> = {
  today: 0.14,
  "3d": 0.4,
  "7d": 1.0,
  "30d": 3.2,
  all: 5.5,
};

const GBP_TO_USD = 1.27;

const OVERLAY_SECTIONS = [
  {
    icon: TrendingUp,
    label: "Profit Tracker",
    getStatus: (s: CollabAccess) =>
      s.profit > 0
        ? `${Math.round((s.profit / s.revenue) * 100)}% margin this week`
        : "Below breakeven — needs attention",
  },
  {
    icon: BarChart3,
    label: "Ad Manager",
    getStatus: (s: CollabAccess) =>
      `ROAS ${s.roas.toFixed(2)} · ${s.adSpend.toLocaleString("en-GB")} ${s.currency} spend`,
  },
  {
    icon: ShoppingBag,
    label: "Products",
    getStatus: () => "4 products live",
  },
];

// ─── Helpers ─────────────────────────────────────────────────

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Page ────────────────────────────────────────────────────

export default function CollaboratorsPage() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "jake";

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<CollabTab>("manage");

  // ── Manage Collaborators state ──
  const [requests, setRequests] = useState<CollabRequest[]>(
    INCOMING_COLLAB_REQUESTS[userId] ?? []
  );
  const [approvedCollabs, setApprovedCollabs] = useState<CollabAccess[]>([]);
  const [denyModal, setDenyModal] = useState<{
    open: boolean;
    requestId: string;
    name: string;
  }>({ open: false, requestId: "", name: "" });
  const [removeModal, setRemoveModal] = useState<{
    open: boolean;
    collabId: string;
    name: string;
  }>({ open: false, collabId: "", name: "" });

  // ── Request Access state ──
  const [requestInput, setRequestInput] = useState("");
  const [sentRequests, setSentRequests] = useState<SentCollabRequest[]>(
    SENT_COLLAB_REQUESTS[userId] ?? []
  );

  // ── View Stores state ──
  const accessList = useMemo<CollabAccess[]>(
    () => MY_COLLAB_ACCESS[userId] ?? [],
    [userId]
  );
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [overlayStore, setOverlayStore] = useState<CollabAccess | null>(null);
  const [sortKey, setSortKey] = useState<string>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) return prev;
      setSortDir("desc");
      return key;
    });
    setSortDir((prev) => (sortKey === key ? (prev === "asc" ? "desc" : "asc") : "desc"));
  }, [sortKey]);

  const scaledAccessList = useMemo(() => {
    const f = PERIOD_FACTOR[period];
    return accessList
      .map((s) => {
        const revenue = Math.round(s.revenue * f);
        const adSpend = Math.round(s.adSpend * f);
        const profit = Math.round(s.profit * f);
        const roas = adSpend > 0 ? parseFloat((revenue / adSpend).toFixed(2)) : 0;
        const profitPercent = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0;
        return { ...s, revenue, adSpend, profit, roas, profitPercent };
      })
      .sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey];
        const bVal = (b as Record<string, unknown>)[sortKey];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        const an = aVal as number;
        const bn = bVal as number;
        return sortDir === "asc" ? an - bn : bn - an;
      })
      .map((s, idx) => ({ ...s, rank: idx + 1 }));
  }, [accessList, period, sortKey, sortDir]);

  const totals = useMemo(() => {
    let revenue = 0, adSpend = 0, profit = 0;
    for (const s of scaledAccessList) {
      revenue += s.revenue;
      adSpend += s.adSpend;
      profit += s.profit;
    }
    return { revenue, adSpend, profit, activeStudents: scaledAccessList.length };
  }, [scaledAccessList]);

  const totalsUsd = useMemo(() => ({
    revenue: Math.round(totals.revenue * GBP_TO_USD),
    adSpend: Math.round(totals.adSpend * GBP_TO_USD),
    profit: Math.round(totals.profit * GBP_TO_USD),
  }), [totals]);

  // ── Derived ──
  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "pending"),
    [requests]
  );

  const myStoreId = USER_STORE_IDS[userId] ?? "OLY-000";

  // ── Handlers ──

  const handleAccept = useCallback(
    (req: CollabRequest) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: "approved" } : r
        )
      );
      // Add to approved collaborators with today's date
      const newAccess: CollabAccess = {
        id: `approved-${req.id}`,
        storeId: userId,
        storeName: user?.name ? `${user.name}'s Store` : "My Store",
        ownerName: req.requesterName,
        ownerInitials: req.requesterInitials,
        market: "UK",
        currency: "£",
        revenue: 0,
        adSpend: 0,
        profit: 0,
        roas: 0,
        status: "Active",
        addedAt: new Date().toISOString(),
      };
      setApprovedCollabs((prev) => [...prev, newAccess]);
    },
    [userId, user?.name]
  );

  const handleDenyConfirm = useCallback(() => {
    setRequests((prev) =>
      prev.filter((r) => r.id !== denyModal.requestId)
    );
  }, [denyModal.requestId]);

  const handleRemoveConfirm = useCallback(() => {
    setApprovedCollabs((prev) =>
      prev.filter((c) => c.id !== removeModal.collabId)
    );
  }, [removeModal.collabId]);

  const handleSendRequest = useCallback(() => {
    const storeId = requestInput.trim();
    if (!storeId) return;
    const newReq: SentCollabRequest = {
      id: `sr-new-${Date.now()}`,
      targetStoreName: storeId,
      targetOwnerName: "—",
      sentAt: new Date().toISOString(),
      status: "pending",
    };
    setSentRequests((prev) => [newReq, ...prev]);
    setRequestInput("");
  }, [requestInput]);

  // ─── Render ──────────────────────────────────────────────

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
          <Users className="text-accent-indigo" size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-2xl font-syne font-bold tracking-tight">
            Collaborators
          </h1>
          <p className="text-sm text-text-secondary">
            Manage store access and view collaborative stores
          </p>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="flex items-center gap-1 mb-6 border-b border-subtle">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.key
                ? "text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {tab.label}
            {/* Pending dot on Manage tab */}
            {tab.key === "manage" && pendingRequests.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent-amber text-[9px] font-bold text-black">
                {pendingRequests.length}
              </span>
            )}
            {activeTab === tab.key && (
              <motion.div
                layoutId="collab-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-indigo rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ─── Manage Collaborators Tab ─── */}
      {activeTab === "manage" && (
        <div className="space-y-8">

          {/* ── Incoming Requests ── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <UserPlus size={15} strokeWidth={1.8} className="text-text-muted" />
              <h2 className="text-sm font-syne font-semibold text-text-primary">
                Requests to Access Your Store
              </h2>
              {pendingRequests.length > 0 && (
                <span className="text-[10px] font-jetbrains font-semibold px-2 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber">
                  {pendingRequests.length}
                </span>
              )}
            </div>

            {pendingRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-subtle px-6 py-8 flex items-center justify-center">
                <p className="text-sm text-text-muted">No pending requests</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {pendingRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="card px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-indigo/10 flex items-center justify-center shrink-0 text-sm font-semibold text-accent-indigo">
                          {req.requesterInitials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-text-primary">
                              {req.requesterName}
                            </p>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent-indigo/10 text-accent-indigo">
                              Coach
                            </span>
                          </div>
                          <p className="text-[12px] text-text-muted mt-0.5">
                            Requested {relativeTime(req.sentAt)} · wants collaborator access to your store
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAccept(req)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25 transition-colors"
                        >
                          <Check size={13} strokeWidth={2.5} />
                          Accept
                        </button>
                        <button
                          onClick={() =>
                            setDenyModal({
                              open: true,
                              requestId: req.id,
                              name: req.requesterName,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white/[0.04] text-text-secondary hover:bg-accent-red/10 hover:text-accent-red transition-colors"
                        >
                          <X size={13} strokeWidth={2.5} />
                          Deny
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}
          </section>

          {/* ── Approved Collaborators ── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users size={15} strokeWidth={1.8} className="text-text-muted" />
              <h2 className="text-sm font-syne font-semibold text-text-primary">
                Currently Has Access
              </h2>
            </div>

            {approvedCollabs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-subtle px-6 py-8 flex items-center justify-center">
                <p className="text-sm text-text-muted">
                  No collaborators have access yet
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {approvedCollabs.map((collab) => (
                    <motion.div
                      key={collab.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="card px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-emerald/10 flex items-center justify-center shrink-0 text-sm font-semibold text-accent-emerald">
                          {collab.ownerInitials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-text-primary">
                              {collab.ownerName}
                            </p>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald">
                              Collaborator
                            </span>
                          </div>
                          <p className="text-[12px] text-text-muted mt-0.5">
                            Added {formatDate(collab.addedAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setRemoveModal({
                            open: true,
                            collabId: collab.id,
                            name: collab.ownerName,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                      >
                        Remove Access
                      </button>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}
          </section>

          {/* ── Request Store Access ── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Send size={15} strokeWidth={1.8} className="text-text-muted" />
              <h2 className="text-sm font-syne font-semibold text-text-primary">
                Request Store Access
              </h2>
            </div>

            <div className="card p-5">
              {/* Share your own ID */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-subtle">
                <span className="text-[11px] text-text-muted">Your Store ID:</span>
                <span className="font-jetbrains text-[12px] text-text-secondary font-medium">
                  {myStoreId}
                </span>
                <span className="text-[10px] text-text-muted ml-1">
                  — share this so others can request access to your store
                </span>
              </div>

              <p className="text-[12px] text-text-secondary mb-3">
                Enter a Store ID to request collaborator access to that store.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={requestInput}
                  onChange={(e) => setRequestInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
                  placeholder="e.g. OLY-VMB-001"
                  className={cn(
                    "flex-1 px-3.5 py-2.5 rounded-lg text-sm",
                    "bg-white/[0.03] border border-subtle",
                    "text-text-primary placeholder:text-text-muted",
                    "focus:outline-none focus:ring-1 focus:ring-accent-indigo/40 focus:border-accent-indigo/30",
                    "transition-colors duration-150 font-jetbrains"
                  )}
                />
                <button
                  onClick={handleSendRequest}
                  disabled={!requestInput.trim()}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    requestInput.trim()
                      ? "bg-accent-indigo hover:bg-accent-indigo/90 text-white"
                      : "bg-white/[0.03] text-text-muted cursor-not-allowed"
                  )}
                >
                  <Send size={14} />
                  Send Request
                </button>
              </div>

              {/* Sent requests list */}
              {sentRequests.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                    Sent Requests
                  </h3>
                  <div className="space-y-2">
                    {sentRequests.map((sr) => {
                      const style = SENT_STATUS_STYLE[sr.status];
                      return (
                        <div
                          key={sr.id}
                          className="flex items-center justify-between gap-3 py-2.5 border-b border-subtle last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center text-[10px] font-semibold text-text-muted">
                              {initials(sr.targetStoreName)}
                            </div>
                            <div>
                              <p className="text-sm text-text-primary font-medium">
                                {sr.targetStoreName}
                              </p>
                              {sr.targetOwnerName !== "—" && (
                                <p className="text-[11px] text-text-muted">
                                  {sr.targetOwnerName}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-text-muted font-jetbrains">
                              {relativeTime(sr.sentAt)}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                                style.bg,
                                style.text
                              )}
                            >
                              {style.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ─── View Stores Tab ─── */}
      {activeTab === "view-stores" && (
        <div>
          {accessList.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                <Eye size={22} strokeWidth={1.5} className="text-text-muted" />
              </div>
              <div className="text-center">
                <p className="text-text-primary font-medium mb-1">
                  No stores to view yet
                </p>
                <p className="text-sm text-text-muted max-w-xs">
                  You haven&apos;t been added as a collaborator on any stores.
                  Ask a store owner to send you their Store ID so you can request
                  access from the Manage Collaborators tab.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Period selector ── */}
              <div className="flex items-center justify-end mb-5">
                <TimePeriodSelector value={period} onChange={setPeriod} />
              </div>

              {/* ── Aggregate metric cards ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <MetricCard
                  label="Total Revenue"
                  value={totalsUsd.revenue}
                  format="currency"
                  currency="$"
                />
                <MetricCard
                  label="Total Ad Spend"
                  value={totalsUsd.adSpend}
                  format="currency"
                  currency="$"
                />
                <MetricCard
                  label="Total Profit"
                  value={totalsUsd.profit}
                  format="currency"
                  currency="$"
                />
                <MetricCard
                  label="Active Stores"
                  value={totals.activeStudents}
                  format="number"
                />
              </div>

              {/* ── Performance chart ── */}
              <div className="card p-5 mb-6">
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-4">
                  Total Revenue · Ad Spend · Profit (USD)
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={[
                      {
                        name: "Totals",
                        Revenue: totalsUsd.revenue,
                        "Ad Spend": totalsUsd.adSpend,
                        Profit: totalsUsd.profit,
                      },
                    ]}
                    margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
                    barCategoryGap="28%"
                    barGap={3}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#8A8A9B", fontSize: 11, fontFamily: "Inter" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#8A8A9B", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      contentStyle={{
                        background: "#1A1A24",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 12,
                        color: "#F1F1F3",
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`$${Number(value).toLocaleString("en-US")}`]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: 11, color: "#8A8A9B", paddingTop: 12 }}
                    />
                    <Bar dataKey="Revenue" fill="#6C63FF" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Ad Spend" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Profit" fill="#10B981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ── Stores table ── */}
              <div className="overflow-x-auto rounded-xl border border-subtle bg-bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-subtle">
                      {/* Non-sortable rank */}
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-center w-12">
                        #
                      </th>
                      {/* Sortable columns */}
                      {(
                        [
                          { key: "storeName", label: "Store", align: "left", cls: "" },
                          { key: "ownerName", label: "Owner", align: "left", cls: "hidden sm:table-cell" },
                          { key: "revenue", label: "Revenue", align: "right", cls: "" },
                          { key: "adSpend", label: "Ad Spend", align: "right", cls: "hidden md:table-cell" },
                          { key: "profit", label: "Profit", align: "right", cls: "" },
                          { key: "profitPercent", label: "Profit %", align: "right", cls: "hidden md:table-cell" },
                          { key: "roas", label: "ROAS", align: "right", cls: "hidden lg:table-cell" },
                          { key: "status", label: "Status", align: "center", cls: "" },
                        ] as const
                      ).map((col) => {
                        const active = sortKey === col.key;
                        const Icon = active
                          ? sortDir === "desc"
                            ? ArrowDown
                            : ArrowUp
                          : ArrowUpDown;
                        return (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className={cn(
                              "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none",
                              "transition-colors duration-150 hover:text-text-secondary",
                              active ? "text-accent-indigo" : "text-text-muted",
                              col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                              col.cls
                            )}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.align === "right" && (
                                <Icon size={11} strokeWidth={2} className="opacity-60" />
                              )}
                              {col.label}
                              {col.align !== "right" && (
                                <Icon size={11} strokeWidth={2} className="opacity-60" />
                              )}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {scaledAccessList.map((store) => (
                      <tr
                        key={store.id}
                        onClick={() => setOverlayStore(store)}
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
                            {store.ownerName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                          {store.currency}{store.revenue.toLocaleString("en-GB")}
                        </td>
                        <td className="px-4 py-3 text-right font-jetbrains text-text-secondary tabular-nums hidden md:table-cell">
                          {store.currency}{store.adSpend.toLocaleString("en-GB")}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right font-jetbrains font-medium tabular-nums",
                            store.profit >= 0 ? "text-accent-emerald" : "text-accent-red"
                          )}
                        >
                          {store.profit < 0 ? "-" : ""}{store.currency}
                          {Math.abs(store.profit).toLocaleString("en-GB")}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right font-jetbrains font-medium tabular-nums hidden md:table-cell",
                            store.profitPercent >= 20
                              ? "text-accent-emerald"
                              : store.profitPercent >= 0
                                ? "text-accent-amber"
                                : "text-accent-red"
                          )}
                        >
                          {store.profitPercent.toFixed(1)}%
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
            </>
          )}
        </div>
      )}

      {/* ─── Full Store Overlay ─── */}
      <AnimatePresence>
        {overlayStore && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-0 z-50 bg-bg-primary overflow-y-auto"
          >
            {/* Amber "viewing" banner */}
            <div className="sticky top-0 z-10 border-b border-subtle glass">
              {/* Collaborator context strip */}
              <div className="flex items-center gap-2 px-6 py-2 bg-accent-amber/[0.08] border-b border-accent-amber/20">
                <AlertTriangle
                  size={13}
                  strokeWidth={2}
                  className="text-accent-amber shrink-0"
                />
                <span className="text-[12px] text-accent-amber font-medium">
                  Viewing {overlayStore.storeName} &middot;{" "}
                  {overlayStore.ownerName}&apos;s Store &middot; Collaborator
                  Access
                </span>
              </div>

              {/* Nav bar */}
              <div className="flex items-center justify-between px-6 py-3.5">
                <button
                  onClick={() => setOverlayStore(null)}
                  className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft size={16} strokeWidth={2} />
                  Back to Collaborators
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-accent-indigo/10 flex items-center justify-center text-xs font-semibold text-accent-indigo">
                    {overlayStore.ownerInitials}
                  </div>
                  <span className="text-sm font-syne font-semibold text-text-primary">
                    {overlayStore.storeName}
                  </span>
                </div>
              </div>
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
                    Owned by {overlayStore.ownerName} &middot;{" "}
                    {overlayStore.market} &middot; {overlayStore.currency}
                  </p>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <MetricCard
                  label="Revenue"
                  value={overlayStore.revenue}
                  format="currency"
                  currency={overlayStore.currency}
                />
                <MetricCard
                  label="Ad Spend"
                  value={overlayStore.adSpend}
                  format="currency"
                  currency={overlayStore.currency}
                />
                <MetricCard
                  label="Profit"
                  value={overlayStore.profit}
                  format="currency"
                  currency={overlayStore.currency}
                />
                <MetricCard
                  label="ROAS"
                  value={overlayStore.roas}
                  format="number"
                />
              </div>

              {/* Module sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {OVERLAY_SECTIONS.map((section) => (
                  <div key={section.label} className="card p-5">
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
                      {section.getStatus(overlayStore)}
                    </p>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-accent-indigo/10 text-accent-indigo hover:bg-accent-indigo/20 transition-colors">
                      <Eye size={12} />
                      View Details
                    </button>
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
                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-accent-indigo/10 text-accent-indigo hover:bg-accent-indigo/20 transition-colors">
                      Scale Campaigns
                    </button>
                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors">
                      Kill Campaigns
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Deny Modal ─── */}
      <ConfirmModal
        open={denyModal.open}
        onClose={() => setDenyModal((prev) => ({ ...prev, open: false }))}
        onConfirm={handleDenyConfirm}
        title={`Deny request from ${denyModal.name}?`}
        description={`${denyModal.name} will not be granted collaborator access to your store. You can always accept a new request later.`}
        confirmLabel="Deny Request"
        variant="danger"
      />

      {/* ─── Remove Modal ─── */}
      <ConfirmModal
        open={removeModal.open}
        onClose={() => setRemoveModal((prev) => ({ ...prev, open: false }))}
        onConfirm={handleRemoveConfirm}
        title={`Remove ${removeModal.name}?`}
        description={`${removeModal.name} will lose collaborator access to your store immediately.`}
        confirmLabel="Remove Access"
        variant="danger"
      />
    </div>
  );
}
