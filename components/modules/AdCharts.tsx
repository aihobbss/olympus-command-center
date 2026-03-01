"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { AdCampaign } from "@/data/mock";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdChartsProps {
  campaigns: AdCampaign[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LINE_COLORS = ["#6C63FF", "#EF4444", "#F59E0B", "#10B981"] as const;

/**
 * Deterministic pseudo-random variance so the chart looks organic but stays
 * stable across re-renders. Uses a simple string-hash seeded LCG.
 */
function seededVariance(seed: string, day: number, base: number): number {
  let hash = 0;
  const combined = `${seed}-${day}`;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0; // convert to 32-bit int
  }

  // LCG step — produces a float in [0, 1)
  const t = ((Math.abs(hash) * 9301 + 49297) % 233280) / 233280;

  // Map to [-0.4, +0.4] range around base, clamp >= 0
  const variance = (t - 0.5) * 0.8; // +-0.4
  return Math.max(0, parseFloat((base + variance).toFixed(2)));
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface PayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  campaignNameMap,
}: {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string;
  campaignNameMap: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-bg-elevated border border-subtle rounded-lg shadow-xl px-3 py-2.5">
      <p className="text-[11px] text-text-muted mb-1.5 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[11px] text-text-secondary truncate max-w-[140px]">
            {campaignNameMap[entry.dataKey] ?? entry.dataKey}
          </span>
          <span className="text-[11px] font-jetbrains font-semibold text-text-primary ml-auto pl-3">
            {entry.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdCharts({ campaigns }: AdChartsProps) {
  // Build the merged 7-day data + a name lookup map
  const { chartData, campaignNameMap } = useMemo(() => {
    const nameMap: Record<string, string> = {};

    if (campaigns.length === 0) {
      return { chartData: [], campaignNameMap: nameMap };
    }

    campaigns.forEach((c) => {
      nameMap[c.id] = c.campaignName;
    });

    const data: Record<string, string | number>[] = [];

    for (let day = 1; day <= 7; day++) {
      const point: Record<string, string | number> = { day: `Day ${day}` };
      campaigns.forEach((c) => {
        point[c.id] = seededVariance(c.id, day, c.roas);
      });
      data.push(point);
    }

    return { chartData: data, campaignNameMap: nameMap };
  }, [campaigns]);

  if (campaigns.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-syne font-semibold text-text-primary mb-4">
          7-Day ROAS Trend
        </h3>
        <p className="text-xs text-text-muted">No campaigns to display.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-syne font-semibold text-text-primary mb-4">
        7-Day ROAS Trend
      </h3>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
          />
          <XAxis
            dataKey="day"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            domain={[0, "auto"]}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={
              <ChartTooltip campaignNameMap={campaignNameMap} />
            }
            cursor={{ stroke: "rgba(255,255,255,0.06)" }}
          />
          {campaigns.map((campaign, idx) => (
            <Line
              key={campaign.id}
              dataKey={campaign.id}
              stroke={LINE_COLORS[idx % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Custom Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 px-1">
        {campaigns.map((campaign, idx) => (
          <div key={campaign.id} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor: LINE_COLORS[idx % LINE_COLORS.length],
              }}
            />
            <span className="text-[11px] text-text-secondary">
              {campaign.campaignName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
