"use client";

import { useState, useEffect } from "react";
import { TrendingUp, X, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionSlider, ConfirmModal, StatusBadge } from "@/components/ui";
import type { AdCampaign } from "@/data/mock";

// ─── Types ──────────────────────────────────────────────────

interface AdActionPanelProps {
  campaign: AdCampaign | null;
  open: boolean;
  onClose: () => void;
  onScale: (id: string, newBudget: number) => void;
  onKill: (id: string) => void;
  onPass: (id: string) => void;
  storeCurrency: string;
  toUsd: (localAmount: number) => number;
}

// ─── Helpers ────────────────────────────────────────────────

const statusVariant: Record<
  AdCampaign["status"],
  "success" | "warning" | "danger"
> = {
  Scaling: "success",
  Watch: "warning",
  Kill: "danger",
};

function formatCurrency(value: number, currency: string): string {
  const abs = Math.abs(value);
  const formatted =
    abs >= 1000
      ? abs.toLocaleString("en-GB", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : abs.toLocaleString("en-GB", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  return `${value < 0 ? "-" : ""}${currency}${formatted}`;
}

// ─── Component ──────────────────────────────────────────────

export function AdActionPanel({
  campaign,
  open,
  onClose,
  onScale,
  onKill,
  onPass,
  storeCurrency,
  toUsd,
}: AdActionPanelProps) {
  const [showScaleInput, setShowScaleInput] = useState(false);
  const [scaleBudget, setScaleBudget] = useState(0);
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  // Reset internal state when campaign changes
  useEffect(() => {
    setShowScaleInput(false);
    setShowKillConfirm(false);
    if (campaign) {
      setScaleBudget(Math.round(campaign.budget * 2));
    }
  }, [campaign]);

  if (!campaign) return null;

  return (
    <>
      <ActionSlider
        open={open}
        onClose={onClose}
        title="Campaign Actions"
      >
        {/* ── Campaign Summary ────────────────────────────── */}
        <div className="space-y-4">
          {/* Name + Product */}
          <div>
            <h4 className="font-syne text-lg font-semibold text-text-primary leading-tight">
              {campaign.campaignName}
            </h4>
            <span className="text-sm text-text-secondary mt-1 block">
              {campaign.product}
            </span>
          </div>

          {/* Status */}
          <StatusBadge
            status={campaign.status}
            variant={statusVariant[campaign.status]}
            size="md"
          />

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Spend */}
            <div className="rounded-lg border border-subtle bg-white/[0.03] p-3">
              <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-1">
                Spend
              </div>
              <div className="font-jetbrains text-sm font-semibold text-text-primary">
                {formatCurrency(campaign.spend, "$")}
              </div>
            </div>

            {/* Revenue — dual currency */}
            <div className="rounded-lg border border-subtle bg-white/[0.03] p-3">
              <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-1">
                Revenue
              </div>
              <div className="font-jetbrains text-sm font-semibold text-text-primary">
                {formatCurrency(campaign.revenue, storeCurrency)}
              </div>
              <div className="font-jetbrains text-[11px] text-text-secondary mt-0.5">
                ${toUsd(campaign.revenue).toLocaleString("en-GB")} USD
              </div>
            </div>

            {/* ROAS */}
            <div className="rounded-lg border border-subtle bg-white/[0.03] p-3">
              <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-1">
                ROAS
              </div>
              <div
                className={cn(
                  "font-jetbrains text-sm font-semibold",
                  campaign.roas < 1
                    ? "text-accent-red"
                    : campaign.roas <= 2
                      ? "text-accent-amber"
                      : "text-accent-emerald"
                )}
              >
                {campaign.roas.toFixed(2)}x
              </div>
            </div>

            {/* Profit — dual currency */}
            <div className="rounded-lg border border-subtle bg-white/[0.03] p-3">
              <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-1">
                Profit
              </div>
              <div
                className={cn(
                  "font-jetbrains text-sm font-semibold",
                  campaign.profit < 0
                    ? "text-accent-red"
                    : "text-text-primary"
                )}
              >
                {formatCurrency(campaign.profit, storeCurrency)}
              </div>
              <div className="font-jetbrains text-[11px] text-text-secondary mt-0.5">
                ${toUsd(campaign.profit).toLocaleString("en-GB")} USD
              </div>
            </div>

            {/* Budget */}
            <div className="rounded-lg border border-subtle bg-white/[0.03] p-3">
              <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-1">
                Budget
              </div>
              <div className="font-jetbrains text-sm font-semibold text-text-primary">
                {formatCurrency(campaign.budget, "$")}/day
              </div>
            </div>

            {/* CPC */}
            <div className="rounded-lg border border-subtle bg-white/[0.03] p-3">
              <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-1">
                CPC
              </div>
              <div className="font-jetbrains text-sm font-semibold text-text-primary">
                ${campaign.cpc.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="rounded-lg border border-subtle bg-white/[0.02] p-3">
            <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-1.5">
              Recommendation
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {campaign.recommendation}
            </p>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────── */}
        <div className="border-t border-subtle my-5" />

        {/* ── Action Buttons ──────────────────────────────── */}
        <div className="space-y-3">
          {/* Scale */}
          {!showScaleInput ? (
            <button
              onClick={() => setShowScaleInput(true)}
              className={cn(
                "w-full flex items-center justify-center gap-2",
                "px-4 py-2.5 rounded-lg text-sm font-medium",
                "bg-accent-emerald/15 text-accent-emerald",
                "hover:bg-accent-emerald/25 transition-colors duration-150"
              )}
            >
              <TrendingUp size={16} strokeWidth={2} />
              Scale Campaign
            </button>
          ) : (
            <div className="rounded-lg border border-accent-emerald/30 bg-accent-emerald/[0.05] p-3 space-y-3">
              <label className="block">
                <span className="text-[11px] text-text-secondary font-medium uppercase tracking-wider">
                  New daily budget
                </span>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted font-jetbrains">
                    $
                  </span>
                  <input
                    type="number"
                    value={scaleBudget}
                    onChange={(e) =>
                      setScaleBudget(Number(e.target.value))
                    }
                    className={cn(
                      "w-full rounded-lg border border-subtle bg-white/[0.04]",
                      "pl-7 pr-3 py-2 text-sm font-jetbrains text-text-primary",
                      "focus:outline-none focus:ring-1 focus:ring-accent-emerald/50",
                      "placeholder:text-text-muted"
                    )}
                  />
                </div>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onScale(campaign.id, scaleBudget);
                    setShowScaleInput(false);
                  }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2",
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-accent-emerald text-white",
                    "hover:bg-accent-emerald/80 transition-colors duration-150"
                  )}
                >
                  <TrendingUp size={14} strokeWidth={2} />
                  Confirm Scale
                </button>
                <button
                  onClick={() => setShowScaleInput(false)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium",
                    "text-text-secondary hover:text-text-primary",
                    "bg-white/[0.04] hover:bg-white/[0.06]",
                    "transition-colors duration-150"
                  )}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Kill */}
          <button
            onClick={() => setShowKillConfirm(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              "px-4 py-2.5 rounded-lg text-sm font-medium",
              "bg-accent-red/15 text-accent-red",
              "hover:bg-accent-red/25 transition-colors duration-150"
            )}
          >
            <X size={16} strokeWidth={2} />
            Kill Campaign
          </button>

          {/* Pass */}
          <button
            onClick={() => onPass(campaign.id)}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              "px-4 py-2.5 rounded-lg text-sm font-medium",
              "bg-white/[0.04] text-text-secondary",
              "hover:bg-white/[0.06] hover:text-text-primary",
              "transition-colors duration-150"
            )}
          >
            <MinusCircle size={16} strokeWidth={2} />
            Pass
          </button>
        </div>
      </ActionSlider>

      {/* ── Kill Confirmation Modal ───────────────────────── */}
      <ConfirmModal
        open={showKillConfirm}
        onClose={() => setShowKillConfirm(false)}
        onConfirm={() => onKill(campaign.id)}
        title={`Kill "${campaign.campaignName}"?`}
        description="This will pause the campaign and mark it as killed. This action cannot be undone."
        confirmLabel="Kill Campaign"
        variant="danger"
      />
    </>
  );
}
