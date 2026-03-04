"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type TimePeriod = "today" | "3d" | "7d" | "30d" | "all";

export interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
  className?: string;
  layoutId?: string;
}

const periods: { key: TimePeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "3d", label: "3D" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "All Time" },
];

export function TimePeriodSelector({
  value,
  onChange,
  className,
  layoutId = "period-pill",
}: TimePeriodSelectorProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-1 border border-subtle",
        className
      )}
    >
      {periods.map((period) => {
        const isActive = value === period.key;

        return (
          <button
            key={period.key}
            onClick={() => onChange(period.key)}
            className={cn(
              "relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150",
              isActive
                ? "text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-accent-indigo/15 ring-1 ring-accent-indigo/25"
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
            <span className="relative z-10">{period.label}</span>
          </button>
        );
      })}
    </div>
  );
}
