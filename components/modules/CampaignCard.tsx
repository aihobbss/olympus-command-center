"use client";

import { motion } from "framer-motion";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdCampaign } from "@/data/mock";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: AdCampaign;
  onClick: (campaign: AdCampaign) => void;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const statusVariantMap: Record<
  AdCampaign["status"],
  "success" | "danger" | "warning"
> = {
  Scaling: "success",
  Kill: "danger",
  Watch: "warning",
};

const marketColors: Record<AdCampaign["market"], string> = {
  AU: "bg-accent-amber/15 text-accent-amber ring-1 ring-accent-amber/20",
  UK: "bg-accent-emerald/15 text-accent-emerald ring-1 ring-accent-emerald/20",
  USA: "bg-accent-indigo/15 text-accent-indigo ring-1 ring-accent-indigo/20",
};

function formatCurrency(
  value: number,
  currency: string,
  decimals?: number
): string {
  const abs = Math.abs(value);
  const fixed =
    decimals !== undefined
      ? abs.toFixed(decimals)
      : abs >= 1000
        ? abs.toLocaleString("en-GB", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        : abs.toLocaleString("en-GB", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
  return `${value < 0 ? "-" : ""}${currency}${fixed}`;
}

function roasColor(roas: number): string {
  if (roas < 1) return "text-accent-red";
  if (roas <= 2) return "text-accent-amber";
  return "text-accent-emerald";
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  const {
    campaignName,
    product,
    market,
    spend,
    cpc,
    atc,
    roas,
    revenue,
    profit,
    status,
    recommendation,
    currency,
  } = campaign;

  const metrics: {
    label: string;
    value: string;
    colorClass?: string;
  }[] = [
    {
      label: "Spend",
      value: formatCurrency(spend, currency),
    },
    {
      label: "CPC",
      value: formatCurrency(cpc, currency, 2),
    },
    {
      label: "ATC",
      value: atc.toLocaleString("en-GB"),
    },
    {
      label: "ROAS",
      value: roas.toFixed(2),
      colorClass: roasColor(roas),
    },
    {
      label: "Revenue",
      value: formatCurrency(revenue, currency),
    },
    {
      label: "Profit",
      value: formatCurrency(profit, currency),
      colorClass: profit < 0 ? "text-accent-red" : undefined,
    },
  ];

  return (
    <motion.button
      type="button"
      onClick={() => onClick(campaign)}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "card w-full text-left cursor-pointer",
        "overflow-hidden flex flex-col",
        "hover:border-[var(--border-hover)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-indigo/50"
      )}
    >
      {/* Creative Thumbnail Placeholder */}
      <div className="w-full h-[120px] bg-white/[0.02] flex items-center justify-center shrink-0">
        <ImageIcon
          size={24}
          strokeWidth={1.4}
          className="text-text-muted/50"
        />
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header: Campaign Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-syne font-semibold text-text-primary leading-snug line-clamp-2">
            {campaignName}
          </h3>
          <StatusBadge
            status={status}
            variant={statusVariantMap[status]}
            size="sm"
            className="shrink-0"
          />
        </div>

        {/* Product + Market */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-secondary truncate">
            {product}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5",
              "text-[10px] font-medium tracking-wide shrink-0",
              marketColors[market]
            )}
          >
            {market}
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 pt-1">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium leading-none">
                {m.label}
              </span>
              <span
                className={cn(
                  "text-[14px] font-jetbrains text-text-primary tabular-nums leading-tight",
                  m.colorClass
                )}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Recommendation */}
        <div
          className={cn(
            "mt-auto pt-2.5 border-t border-subtle",
            "px-2.5 py-2 rounded-lg bg-white/[0.02]"
          )}
        >
          <p className="text-[11px] font-mono-metric text-text-secondary leading-relaxed">
            {recommendation}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
