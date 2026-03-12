"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
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
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { useAdCreatorStore, useCreativeGeneratorStore, useStoreContext, useAuthStore, useConnectionsStore } from "@/lib/store";
import { type AdCreatorCampaign, type AdCreatorStatus, type AdGender } from "@/data/mock";
import { cn } from "@/lib/utils";
import { fetchAdAccounts, type UserAdAccount } from "@/lib/services/ad-accounts";

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

const editableInputCn = cn(
  "w-full px-3 py-2 rounded-lg text-xs",
  "bg-bg-elevated border border-subtle outline-none",
  "text-text-primary placeholder:text-text-muted",
  "focus:border-accent-indigo/40 transition-colors duration-150"
);

function ExpandedAdCards({
  campaign,
  onUpdate,
  onRemove,
}: {
  campaign: AdCreatorCampaign;
  onUpdate: (updates: Partial<AdCreatorCampaign>) => void;
  onRemove: () => void;
}) {
  // Read raw array from store, then filter in useMemo to avoid new-reference re-render loops
  const allCreatives = useCreativeGeneratorStore((s) => s.productCreatives);
  const removeCreative = useCreativeGeneratorStore((s) => s.removeCreative);

  const allProductCreatives = useMemo(
    () => allCreatives.filter((c) => c.productName === campaign.productName && c.status === "completed"),
    [allCreatives, campaign.productName]
  );

  // IDs of creatives currently selected for this campaign
  const selectedCreativeIds = new Set(campaign.creatives.map((c) => c.id));

  const toggleCreativeSelection = (creativeId: string) => {
    if (selectedCreativeIds.has(creativeId)) {
      // Deselect — remove from campaign creatives
      onUpdate({
        creatives: campaign.creatives.filter((c) => c.id !== creativeId),
      });
    } else {
      // Select — add to campaign creatives
      const creative = allProductCreatives.find((c) => c.id === creativeId);
      if (creative) {
        onUpdate({
          creatives: [
            ...campaign.creatives,
            {
              id: creative.id,
              concept: creative.concept,
              placeholderGradient: creative.placeholderGradient,
            },
          ],
        });
      }
    }
  };

  const deleteCreativeGlobally = (creativeId: string) => {
    // Remove from campaign
    onUpdate({
      creatives: campaign.creatives.filter((c) => c.id !== creativeId),
    });
    // Remove from global pool
    removeCreative(creativeId);
  };

  const hasAnyCreatives = allProductCreatives.length > 0;

  return (
    <div className="px-6 py-4 bg-white/[0.01] border-t border-subtle/30">
      {/* Campaign structure summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[11px] text-text-muted font-jetbrains">
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-accent-red/70 hover:text-accent-red hover:bg-accent-red/10 transition-colors duration-150"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
            Primary Text
          </div>
          <textarea
            value={campaign.primaryText}
            onChange={(e) => onUpdate({ primaryText: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            rows={4}
            placeholder="Enter primary text..."
            className={cn(editableInputCn, "resize-none")}
          />
        </div>
        <div>
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
            Headline
          </div>
          <input
            type="text"
            value={campaign.headline}
            onChange={(e) => onUpdate({ headline: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Enter headline..."
            className={editableInputCn}
          />
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 mt-3">
            Description
          </div>
          <input
            type="text"
            value={campaign.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Enter description..."
            className={editableInputCn}
          />
        </div>
        <div>
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
            Store Link
          </div>
          <input
            type="text"
            value={campaign.productUrl}
            onChange={(e) => onUpdate({ productUrl: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="https://..."
            className={editableInputCn}
          />
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 mt-3">
            Budget ($/day)
          </div>
          <input
            type="number"
            value={campaign.budget}
            onChange={(e) => onUpdate({ budget: Number(e.target.value) || 0 })}
            onClick={(e) => e.stopPropagation()}
            className={cn(editableInputCn, "font-mono-metric")}
          />
        </div>
      </div>

      {/* Creative cards grid — shows ALL product creatives with select/deselect */}
      {hasAnyCreatives ? (
        <div>
          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
            Product Creatives ({allProductCreatives.length})
            {campaign.creatives.length > 0 && (
              <span className="text-accent-indigo ml-2">
                {campaign.creatives.length} selected as ads
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {allProductCreatives.map((creative) => {
              const isSelected = selectedCreativeIds.has(creative.id);
              return (
                <div
                  key={creative.id}
                  className={cn(
                    "group relative rounded-lg overflow-hidden border transition-all duration-200",
                    isSelected
                      ? "border-accent-indigo ring-1 ring-accent-indigo/30"
                      : "border-subtle hover:border-[var(--border-hover)]"
                  )}
                >
                  <div
                    className={cn(
                      "aspect-square bg-gradient-to-br flex items-center justify-center cursor-pointer",
                      creative.placeholderGradient
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCreativeSelection(creative.id);
                    }}
                  >
                    <span className="text-[10px] font-syne font-semibold text-white/60 text-center leading-snug px-2">
                      {creative.concept}
                    </span>
                  </div>
                  <div className="px-2 py-1.5 bg-bg-card flex items-center justify-between">
                    <span className="text-[10px] text-text-secondary truncate">
                      {creative.concept}
                    </span>
                    {isSelected && (
                      <Check size={10} className="text-accent-indigo shrink-0" />
                    )}
                  </div>

                  {/* Select/deselect checkbox overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCreativeSelection(creative.id);
                    }}
                    className={cn(
                      "absolute top-1.5 left-1.5 w-5 h-5 rounded border flex items-center justify-center transition-all duration-150",
                      isSelected
                        ? "bg-accent-indigo border-accent-indigo text-white"
                        : "bg-black/40 border-white/30 text-transparent group-hover:text-white/50"
                    )}
                  >
                    <Check size={10} strokeWidth={3} />
                  </button>

                  {/* Delete button (global removal) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCreativeGlobally(creative.id);
                    }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white/50 hover:text-white hover:bg-accent-red/80 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
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
  const { campaigns, loading, loadCampaigns, pushCampaign, pushAll, updateCampaign, addCampaign, removeCampaign } = useAdCreatorStore();
  const { selectedStore } = useStoreContext();
  const user = useAuthStore((s) => s.user);
  const metaConnected = useConnectionsStore((s) => s.isConnected("facebook"));
  const storeId = selectedStore?.id;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Ad account selection for publishing
  const [adAccounts, setAdAccounts] = useState<UserAdAccount[]>([]);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>("");

  // Load campaigns from Supabase when store changes
  useEffect(() => {
    if (storeId) loadCampaigns(storeId);
  }, [storeId, loadCampaigns]);

  // Load ad accounts for the publish dropdown
  useEffect(() => {
    if (user && storeId && metaConnected) {
      fetchAdAccounts(user.id, storeId).then((accts) => {
        setAdAccounts(accts);
        // Auto-select first account if none selected
        if (accts.length > 0 && !selectedAdAccountId) {
          setSelectedAdAccountId(accts[0].ad_account_id);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, storeId, metaConnected]);

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

  if (!selectedStore) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 size={24} className="animate-spin text-accent-indigo mb-3" />
        <p className="text-sm text-text-secondary">Loading campaigns…</p>
      </div>
    );
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

        {/* Ad Account selector for publishing */}
        {adAccounts.length > 1 && (
          <select
            value={selectedAdAccountId}
            onChange={(e) => setSelectedAdAccountId(e.target.value)}
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
            {adAccounts.map((acct) => (
              <option key={acct.ad_account_id} value={acct.ad_account_id}>
                {acct.account_name}
              </option>
            ))}
          </select>
        )}

        {/* Push All button */}
        {readyCount > 0 && (
          <button
            onClick={() => pushAll(selectedAdAccountId || undefined)}
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
                "Gender",
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
                <Fragment key={campaign.id}>
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

                    {/* Gender */}
                    <td className="px-3 py-2.5">
                      <select
                        value={campaign.gender}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateCampaign(campaign.id, { gender: e.target.value as AdGender });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs px-2 py-1 rounded-md bg-bg-elevated border border-subtle outline-none text-text-primary cursor-pointer appearance-none pr-5 bg-[length:10px] bg-[right_4px_center] bg-no-repeat"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        }}
                      >
                        <option value="">—</option>
                        <option value="Male">Men</option>
                        <option value="Female">Women</option>
                        <option value="All">All</option>
                      </select>
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
                            pushCampaign(campaign.id, selectedAdAccountId || undefined);
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
                      <td colSpan={10}>
                        <ExpandedAdCards
                          campaign={campaign}
                          onUpdate={(updates) => updateCampaign(campaign.id, updates)}
                          onRemove={() => removeCampaign(campaign.id)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <button
        onClick={addCampaign}
        className="flex items-center gap-1.5 mt-3 px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors duration-150"
      >
        <Plus size={14} />
        Add campaign
      </button>

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
