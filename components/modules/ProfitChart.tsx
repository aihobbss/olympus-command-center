"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { ProfitLog } from "@/data/mock";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProfitChartProps {
  logs: ProfitLog[];
  currency?: string;
  title?: string;
}

interface ChartRow {
  label: string;
  revenue: number;
  profit: number;
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  currency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const revenue = payload.find((p) => p.dataKey === "revenue");
  const profit = payload.find((p) => p.dataKey === "profit");

  return (
    <div className="bg-bg-elevated border border-subtle rounded-lg shadow-xl px-3 py-2.5">
      <p className="text-[11px] text-text-secondary mb-1.5 font-medium">
        {label}
      </p>

      {revenue !== undefined && (
        <div className="flex items-center gap-2 text-[12px]">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "#6C63FF" }}
          />
          <span className="text-text-secondary">Revenue</span>
          <span className="text-text-primary font-medium ml-auto">
            {currency}
            {revenue.value.toLocaleString("en-GB")}
          </span>
        </div>
      )}

      {profit !== undefined && (
        <div className="flex items-center gap-2 text-[12px] mt-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "#10B981" }}
          />
          <span className="text-text-secondary">Profit</span>
          <span className="text-text-primary font-medium ml-auto">
            {currency}
            {profit.value.toLocaleString("en-GB")}
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ProfitChart Component                                              */
/* ------------------------------------------------------------------ */

export default function ProfitChart({
  logs,
  currency = "£",
  title,
}: ProfitChartProps) {
  const chartData = useMemo<ChartRow[]>(() => {
    if (!logs || logs.length === 0) return [];

    // Reverse so oldest is on the left, newest on the right
    return [...logs].reverse().map((log) => ({
      label: new Date(log.date).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      }),
      revenue: log.revenue,
      profit: log.profit,
    }));
  }, [logs]);

  if (chartData.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-syne font-semibold text-text-primary mb-4">
          {title ?? "Revenue vs Profit"}
        </h3>
        <p className="text-text-muted text-xs">No data available.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-syne font-semibold text-text-primary mb-4">
        {title ?? "Revenue vs Profit"}
      </h3>

      {/* ---- Chart ---- */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, bottom: 0, left: -10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
          />

          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={<ChartTooltip currency={currency} />}
            cursor={{ stroke: "rgba(255,255,255,0.06)" }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6C63FF"
            fill="#6C63FF"
            fillOpacity={0.08}
            strokeWidth={2}
          />

          <Area
            type="monotone"
            dataKey="profit"
            stroke="#10B981"
            fill="#10B981"
            fillOpacity={0.06}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* ---- Legend ---- */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: "#6C63FF" }}
          />
          <span className="text-[11px] text-text-secondary">Revenue</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: "#10B981" }}
          />
          <span className="text-[11px] text-text-secondary">Profit</span>
        </div>
      </div>
    </div>
  );
}
