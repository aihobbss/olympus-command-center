"use client";

import { useState, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  Loader2,
  Rocket,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  AlertTriangle,
  Check,
  Globe,
} from "lucide-react";
import { useAdCreatorStore, useStoreContext } from "@/lib/store";
import { type AdCreatorCampaign, type AdCreatorStatus } from "@/data/mock";
import { cn } from "@/lib/utils";

// ── Status badge ────────────────────────────────────────────

const statusConfig: Record<
  AdCreatorStatus,
  { color: string; bg: string; label: string }
> = {
  Queued: {
    color: "text-amber-400",
    bg: "bg-amber-400/15",
    label: "Queued",
  },
  Ready: {
    color: "text-accent-indigo",
    bg: "bg-accent-indigo/15",
    label: "Ready",
  },
  Pushing: {
    color: "text-violet-400",
    bg: "bg-violet-400/15",
    label: "Pushing",
  },
  Live: {
    color: "text-accent-emerald",
    bg: "bg-accent-emerald/15",
    label: "Live",
  },
};

function StatusBadge({ status }: { status: AdCreatorStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium",
        cfg.bg,
        cfg.color
      )}
    >
      {status === "Pushing" && (
        <Loader2 size={11} className="animate-spin" />
      )}
      {status === "Live" && <Check size={11} />}
      {cfg.label}
    </span>
  );
}

// ── Warning badge ───────────────────────────────────────────

function WarningBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-accent-amber/10 text-accent-amber">
      <AlertTriangle size={10} />
      {text}
    </span>
  );
}

// ── Country display ─────────────────────────────────────────

function CountryCell({ market }: { market: string }) {
  const label = market === "AU" ? "Australia" : "United Kingdom";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <Globe size={12} className="text-text-muted" />
      {label}
    </span>
  );
}

// ── Expanded row: individual ad cards ───────────────────────

function ExpandedAdCards({ campaign }: { campaign: AdCreatorCampaign }) {
  const hasCopy = campaign.primaryText.trim() !== "";
  const hasCreatives = campaign.creatives.length > 0;

  return (
    <div className="px-6 py-4 bg-white/[0.01] border-t border-subtle/30">
      {/* Campaign structure summary */}
      <div className="flex items-center gap-2 mb-4 text-[11px] text-text-muted font-jetbrains">
        <span className="text-text-secondary font-medium">1 Campaign</span>
        <span>&rarr;</span>
        <span className="text-text-secondary font-medium">1 Ad Set</span>
        <span>&rarr;</span>
        <span className="text-text-secondary font-medium">
          {campaign.creatives.length} Ad{campaign.creatives.length !== 1 ? "s" : ""}
        </span>
        <span className="ml-2 text-text-muted">
          &middot; ${campaign.budget}/day &middot; {campaign.country}
        </span>
      </div>

      {/* Copy preview */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
            Primary Text
          </div>
          <div className="text-xs text-text-secondary whitespace-pre-wrap line-clamp-4 bg-bg-elevated rounded-lg p-3">
            {hasCopy ? campaign.primaryText : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
            Headline
          </div>
          <div className="text-xs text-text-primary font-medium bg-bg-elevated rounded-lg p-3">
            {campaign.headline || "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
            Description
          </div>
          <div className="text-xs text-text-secondary bg-bg-elevated rounded-lg p-3">
            {campaign.description} &middot; CTA: {campaign.cta}
          </div>
        </div>
      </div>

      {/* Creative cards grid */}
      {hasCreatives ? (
        <div>
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
            Creatives ({campaign.creatives.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {campaign.creatives.map((creative) => (
              <div
                key={creative.id}
                className="rounded-lg overflow-hidden border border-subtle"
              >
                <div
                  className={cn(
                    "aspect-square bg-gradient-to-br flex items-center justify-center",
                    creative.placeholderGradient
                  )}
                >
                  <ImageIcon size={20} className="text-white/40" />
                </div>
                <div className="px-2 py-1.5 bg-bg-card">
                  <span className="text-[10px] text-text-secondary truncate block">
                    {creative.concept}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4 text-xs text-text-muted">
          <AlertTriangle size={14} className="text-accent-amber" />
          No creatives generated yet. Generate creatives in the Creative Generator first.
        </div>
      )}
    </div>
  );
}

// ── Filter types ────────────────────────────────────────────

type StatusFilter = "All" | "Queued" | "Ready" | "Live";

// ── Main component ──────────────────────────────────────────

export function AdCreatorSheet() {
  const { campaigns, pushCampaign, pushAll } = useAdCreatorStore();
  const { selectedStore } = useStoreContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let items = campaigns;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((c) =>
        c.productName.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "All") {
      items = items.filter((c) => c.status === statusFilter);
    }

    return items;
  }, [campaigns, search, statusFilter]);

  const readyCount = useMemo(
    () => campaigns.filter((c) => c.status === "Ready").length,
    [campaigns]
  );

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center mb-4">
          <Rocket size={20} className="text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary mb-1">
          No test campaigns yet
        </p>
        <p className="text-xs text-text-muted">
          Complete Product Creation and Creative Generator to queue campaigns
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Search + Filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className={cn(
              "w-full pl-9 pr-3 py-2 rounded-lg text-xs",
              "bg-bg-elevated border border-subtle outline-none",
              "text-text-primary placeholder:text-text-muted",
              "focus:border-accent-indigo/40 transition-colors duration-150"
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-text-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={cn(
              "text-xs px-3 py-2 rounded-lg",
              "bg-bg-elevated border border-subtle outline-none cursor-pointer",
              "text-text-primary",
              "hover:border-[var(--border-hover)] transition-colors duration-150",
              "appearance-none bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7"
            )}
            style={{
              color: "#F1F1F3",
              backgroundColor: "#1A1A24",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            }}
          >
            <option value="All">All Status</option>
            <option value="Queued">Queued</option>
            <option value="Ready">Ready</option>
            <option value="Live">Live</option>
          </select>
        </div>

        {/* Push All button */}
        {readyCount > 0 && (
          <button
            onClick={pushAll}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              "bg-accent-indigo hover:bg-accent-indigo-hover text-white",
              "shadow-lg shadow-accent-indigo/20 hover:shadow-accent-indigo/30",
              "transition-all duration-200"
            )}
          >
            <Rocket size={14} />
            Create All ({readyCount})
          </button>
        )}

        <span className="text-[11px] text-text-muted font-jetbrains ml-auto">
          {filtered.length} of {campaigns.length}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto scrollbar-hide -mx-1">
        <table className="w-full min-w-[1000px] text-left">
          <thead>
            <tr className="border-b border-subtle">
              {[
                "",
                "Status",
                "Product",
                "Store Link",
                "Copy",
                "Creatives",
                "Budget",
                "Country",
                "",
              ].map((h, i) => (
                <th
                  key={`${h}-${i}`}
                  className={cn(
                    "px-3 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider whitespace-nowrap",
                    i === 0 && "w-8"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((campaign) => {
              const expanded = expandedIds.has(campaign.id);
              const hasCopy = campaign.primaryText.trim() !== "";
              const hasCreatives = campaign.creatives.length > 0;
              const canPush = campaign.status === "Ready";

              return (
                <tr key={campaign.id} className="contents">
                  {/* Main row */}
                  <tr
                    className={cn(
                      "border-b border-subtle/50 hover:bg-white/[0.02] transition-colors duration-100 cursor-pointer",
                      expanded && "bg-white/[0.02]"
                    )}
                    onClick={() => toggleExpand(campaign.id)}
                  >
                    {/* Expand chevron */}
                    <td className="px-3 py-2.5 w-8">
                      {expanded ? (
                        <ChevronDown size={14} className="text-text-muted" />
                      ) : (
                        <ChevronRight size={14} className="text-text-muted" />
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <StatusBadge status={campaign.status} />
                    </td>

                    {/* Product name */}
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-text-primary font-medium">
                        {campaign.productName}
                      </span>
                    </td>

                    {/* Store link */}
                    <td className="px-3 py-2.5">
                      {campaign.productUrl ? (
                        <a
                          href={campaign.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-accent-indigo hover:text-accent-indigo/80 truncate max-w-[160px]"
                        >
                          {(() => {
                            try {
                              return new URL(campaign.productUrl).hostname.replace("www.", "");
                            } catch {
                              return campaign.productUrl.slice(0, 24);
                            }
                          })()}
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>

                    {/* Copy status */}
                    <td className="px-3 py-2.5">
                      {hasCopy ? (
                        <span className="text-xs text-text-secondary truncate max-w-[120px] block">
                          {campaign.primaryText.split("\n")[0]}
                        </span>
                      ) : (
                        <WarningBadge text="Missing copy" />
                      )}
                    </td>

                    {/* Creatives count */}
                    <td className="px-3 py-2.5">
                      {hasCreatives ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                          <ImageIcon size={12} className="text-text-muted" />
                          {campaign.creatives.length} image{campaign.creatives.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <WarningBadge text="No creatives" />
                      )}
                    </td>

                    {/* Budget */}
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono-metric text-text-primary">
                        ${campaign.budget}/day
                      </span>
                    </td>

                    {/* Country */}
                    <td className="px-3 py-2.5">
                      <CountryCell market={selectedStore.market} />
                    </td>

                    {/* Action */}
                    <td className="px-3 py-2.5">
                      {campaign.status === "Pushing" ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-400">
                          <Loader2 size={12} className="animate-spin" />
                        </span>
                      ) : campaign.status === "Live" ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-emerald">
                          <Check size={12} />
                          Live
                        </span>
                      ) : canPush ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            pushCampaign(campaign.id);
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
                            "bg-accent-indigo/15 text-accent-indigo",
                            "hover:bg-accent-indigo/25 transition-colors duration-150"
                          )}
                        >
                          <Rocket size={12} />
                          Push
                        </button>
                      ) : (
                        <span className="text-[11px] text-text-muted">
                          Incomplete
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded && (
                    <tr>
                      <td colSpan={9}>
                        <ExpandedAdCards campaign={campaign} />
                      </td>
                    </tr>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-text-secondary mb-1">
            No matching campaigns
          </p>
          <p className="text-xs text-text-muted">
            Try adjusting your search or filter
          </p>
        </div>
      )}
    </div>
  );
}
