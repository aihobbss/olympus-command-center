"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdCampaign } from "@/data/mock";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface PerAdCardProps {
  campaign: AdCampaign;
  cog: number;
  onCogChange: (id: string, newCog: number) => void;
  storeCurrency: string;
  market: string;
  toUsd: (localAmount: number) => number;
  tierIndicator?: "current" | "scaled";
  scaledToBudget?: number;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatCurrency(
  value: number,
  currency: string,
  decimals?: number
): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-GB", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  });
  return `${value < 0 ? "-" : ""}${currency}${formatted}`;
}

function roasColor(roas: number): string {
  if (roas < 1) return "text-accent-red";
  if (roas <= 2) return "text-accent-amber";
  return "text-accent-emerald";
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function PerAdCard({
  campaign,
  cog,
  onCogChange,
  storeCurrency,
  market,
  toUsd,
  tierIndicator,
  scaledToBudget,
}: PerAdCardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(cog);

  const { product, revenue, spend, orders, roas, profit, cpc, budget } =
    campaign;

  const profitPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
  const fees = revenue * 0.05;
  const minPriceDivisor = market === "UK" ? 1.33 : 0.65;
  const minPrice = (cog * 2) / minPriceDivisor;

  const metrics: {
    label: string;
    value: string;
    subtitle?: string;
    colorClass?: string;
  }[] = [
    {
      label: "Revenue",
      value: formatCurrency(revenue, storeCurrency),
      subtitle: `$${toUsd(revenue).toLocaleString("en-GB")} USD`,
    },
    {
      label: "Ad Spend",
      value: formatCurrency(spend, "$"),
    },
    {
      label: "Orders",
      value: orders.toLocaleString("en-GB"),
    },
    {
      label: "ROAS",
      value: roas.toFixed(2),
      colorClass: roasColor(roas),
    },
    {
      label: "Profit",
      value: formatCurrency(profit, storeCurrency),
      subtitle: `$${toUsd(profit).toLocaleString("en-GB")} USD`,
      colorClass: profit < 0 ? "text-accent-red" : profit > 0 ? "text-accent-emerald" : undefined,
    },
    {
      label: "Profit %",
      value: `${profitPercent.toFixed(1)}%`,
      colorClass: profitPercent < 0 ? "text-accent-red" : profitPercent > 0 ? "text-accent-emerald" : undefined,
    },
    {
      label: "Fees",
      value: formatCurrency(fees, storeCurrency, 2),
    },
    {
      label: "CPC",
      value: formatCurrency(cpc, "$", 2),
    },
    {
      label: "Budget",
      value: `${formatCurrency(budget, "$")}/day`,
    },
    {
      label: "Min Price",
      value: formatCurrency(minPrice, storeCurrency, 2),
    },
  ];

  function handleSave() {
    onCogChange(campaign.id, editValue);
    setEditing(false);
  }

  function handleCancel() {
    setEditValue(cog);
    setEditing(false);
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* ── Header: Product Name + Tier Indicator ────────── */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-syne font-semibold text-text-primary leading-snug truncate">
          {product}
        </h3>
        {tierIndicator === "current" && (
          <StatusBadge status="Current" variant="success" size="sm" className="shrink-0" />
        )}
        {tierIndicator === "scaled" && scaledToBudget && (
          <StatusBadge status={`Scaled to $${scaledToBudget}/day`} variant="warning" size="sm" className="shrink-0" />
        )}
      </div>

      {/* ── Metrics Grid (2 cols) ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium leading-none">
              {m.label}
            </span>
            <span
              className={cn(
                "text-[13px] font-jetbrains text-text-primary tabular-nums leading-tight",
                m.colorClass
              )}
            >
              {m.value}
            </span>
            {m.subtitle && (
              <span className="text-[10px] font-jetbrains text-text-secondary leading-none">
                {m.subtitle}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── COG Section ───────────────────────────────────── */}
      <div className="border-t border-subtle pt-3 mt-auto">
        {!editing ? (
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium leading-none">
                COG
              </span>
              <span className="text-[13px] font-jetbrains text-text-primary tabular-nums leading-tight">
                {formatCurrency(cog, "$", 2)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditValue(cog);
                setEditing(true);
              }}
              className={cn(
                "inline-flex items-center gap-1",
                "text-[10px] font-medium",
                "text-accent-indigo hover:text-accent-indigo-hover",
                "transition-colors duration-150"
              )}
            >
              <Pencil size={10} strokeWidth={2} />
              Edit
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium leading-none">
              COG
            </span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-text-muted font-jetbrains pointer-events-none">
                $
              </span>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(Number(e.target.value))}
                className={cn(
                  "w-full rounded-md border border-subtle bg-white/[0.04]",
                  "pl-7 pr-3 py-1.5 text-[13px] font-jetbrains text-text-primary tabular-nums",
                  "focus:outline-none focus:ring-1 focus:ring-accent-indigo/50",
                  "placeholder:text-text-muted"
                )}
                min={0}
                step={0.01}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                className={cn(
                  "inline-flex items-center gap-1",
                  "px-2.5 py-1 rounded-md text-[10px] font-medium",
                  "bg-accent-indigo/15 text-accent-indigo",
                  "hover:bg-accent-indigo/25 transition-colors duration-150"
                )}
              >
                <Check size={10} strokeWidth={2.5} />
                Save
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className={cn(
                  "inline-flex items-center gap-1",
                  "px-2.5 py-1 rounded-md text-[10px] font-medium",
                  "text-text-secondary hover:text-text-primary",
                  "bg-white/[0.04] hover:bg-white/[0.06]",
                  "transition-colors duration-150"
                )}
              >
                <X size={10} strokeWidth={2.5} />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
