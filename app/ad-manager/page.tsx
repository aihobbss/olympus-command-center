"use client";

import { useState, useMemo, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import { MetricCard, TimePeriodSelector } from "@/components/ui";
import type { TimePeriod } from "@/components/ui";
import { CampaignCard } from "@/components/modules/CampaignCard";
import { AdActionPanel } from "@/components/modules/AdActionPanel";
import { AdCharts } from "@/components/modules/AdCharts";
import { adCampaigns, type AdCampaign } from "@/data/mock";

// ─── Period scaling factors ─────────────────────────────────
// Multipliers that simulate how aggregated numbers change
// depending on the selected time window.

const PERIOD_FACTOR: Record<TimePeriod, number> = {
  today: 0.14,
  "3d": 0.4,
  "7d": 1.0,
  "30d": 3.2,
  all: 5.5,
};

// Small deterministic jitter so each campaign doesn't scale uniformly
function jitter(base: number, seed: number): number {
  const t = ((seed * 9301 + 49297) % 233280) / 233280;
  return base * (0.9 + t * 0.2); // ±10% of the factor
}

// ─── Compute recommendation from scaled data ────────────────

function computeRecommendation(c: {
  spend: number;
  cpc: number;
  atc: number;
  roas: number;
  currency: string;
}): { status: AdCampaign["status"]; recommendation: string } {
  if (c.spend >= 10 && c.cpc > 1 && c.atc === 0) {
    return {
      status: "Kill",
      recommendation: `${c.currency}${Math.round(c.spend)} spent, CPC > ${c.currency}1, 0 ATC — SOP: Kill`,
    };
  }
  if (c.roas >= 2.0 && c.atc >= 5) {
    return {
      status: "Scaling",
      recommendation: `ROAS above 2.0 with strong ATC — SOP: Scale +50%`,
    };
  }
  if (c.roas >= 1.0 && c.roas < 2.0) {
    return {
      status: "Watch",
      recommendation: `${c.currency}${Math.round(c.spend)} spent, ROAS under 2.0 but ATC promising — SOP: Watch`,
    };
  }
  if (c.spend >= 10 && c.cpc > 1 && c.atc <= 2) {
    return {
      status: "Kill",
      recommendation: `${c.currency}${Math.round(c.spend)} spent, CPC > ${c.currency}1, only ${c.atc} ATC — SOP: Kill`,
    };
  }
  return {
    status: "Watch",
    recommendation: `Monitoring — data insufficient for a strong signal`,
  };
}

// ─── Page ───────────────────────────────────────────────────

export default function AdManagerPage() {
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [selectedCampaign, setSelectedCampaign] =
    useState<AdCampaign | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // ── Scale campaigns by period factor ──

  const scaledCampaigns = useMemo(() => {
    const factor = PERIOD_FACTOR[period];

    return adCampaigns.map((c, idx) => {
      const f = jitter(factor, idx * 17 + 3);
      const spend = Math.round(c.spend * f);
      const revenue = Math.round(c.revenue * f);
      const profit = Math.round(c.profit * f);
      const orders = Math.max(0, Math.round(c.orders * f));
      const atc = Math.max(0, Math.round(c.atc * f));
      const cpc = parseFloat((c.cpc * (0.85 + f * 0.15)).toFixed(2));
      const roas = spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;

      const { status, recommendation } = computeRecommendation({
        spend,
        cpc,
        atc,
        roas,
        currency: c.currency,
      });

      return {
        ...c,
        spend,
        cpc,
        atc,
        roas,
        revenue,
        orders,
        profit,
        status,
        recommendation,
      } satisfies AdCampaign;
    });
  }, [period]);

  // ── Aggregated metrics ──

  const totals = useMemo(() => {
    let spend = 0,
      revenue = 0,
      profit = 0,
      orders = 0;
    for (const c of scaledCampaigns) {
      spend += c.spend;
      revenue += c.revenue;
      profit += c.profit;
      orders += c.orders;
    }
    const roas = spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;
    return { spend, revenue, profit, orders, roas };
  }, [scaledCampaigns]);

  // ── Card click → open panel ──

  const handleCardClick = useCallback((campaign: AdCampaign) => {
    setSelectedCampaign(campaign);
    setPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // ── Panel actions (demo — just close panel) ──

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleScale = useCallback((id: string, newBudget: number) => {
    setPanelOpen(false);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleKill = useCallback((id: string) => {
    setPanelOpen(false);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePass = useCallback((id: string) => {
    setPanelOpen(false);
  }, []);

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
            <BarChart3
              className="text-accent-indigo"
              size={20}
              strokeWidth={1.8}
            />
          </div>
          <div>
            <h1 className="text-2xl font-syne font-bold tracking-tight">
              Ad Manager
            </h1>
            <p className="text-sm text-text-secondary">
              Live Meta campaigns with kill/scale recommendations
            </p>
          </div>
        </div>

        <TimePeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <MetricCard
          label="Total Spend"
          value={totals.spend}
          format="currency"
          currency="£"
        />
        <MetricCard
          label="Revenue"
          value={totals.revenue}
          format="currency"
          currency="£"
        />
        <MetricCard
          label="Profit"
          value={totals.profit}
          format="currency"
          currency="£"
        />
        <MetricCard label="Orders" value={totals.orders} format="number" />
        <MetricCard
          label="Avg ROAS"
          value={totals.roas}
          format="number"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* ─── Campaign Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {scaledCampaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onClick={handleCardClick}
          />
        ))}
      </div>

      {/* ─── ROAS Trend Chart ─── */}
      <AdCharts campaigns={scaledCampaigns} />

      {/* ─── Action Panel (slides in from right) ─── */}
      <AdActionPanel
        campaign={selectedCampaign}
        open={panelOpen}
        onClose={handleClosePanel}
        onScale={handleScale}
        onKill={handleKill}
        onPass={handlePass}
      />
    </div>
  );
}
