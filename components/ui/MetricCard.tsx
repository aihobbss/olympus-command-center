"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: number;
  delta?: number;
  deltaType?: "up" | "down";
  format?: "currency" | "percent" | "number";
  currency?: string;
  subtitle?: string;
  className?: string;
  valueClassName?: string;
  onClick?: () => void;
}

function formatDisplay(
  raw: number,
  format: "currency" | "percent" | "number",
  currency: string
): string {
  switch (format) {
    case "currency": {
      const abs = Math.abs(raw);
      const formatted =
        abs >= 1000
          ? abs.toLocaleString("en-GB", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })
          : abs.toLocaleString("en-GB", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            });
      return `${raw < 0 ? "-" : ""}${currency}${formatted}`;
    }
    case "percent":
      return `${raw.toFixed(1)}%`;
    default: {
      const useDecimals = raw % 1 !== 0 && Math.abs(raw) < 100;
      return raw.toLocaleString("en-GB", {
        minimumFractionDigits: useDecimals ? 2 : 0,
        maximumFractionDigits: useDecimals ? 2 : 0,
      });
    }
  }
}

export function MetricCard({
  label,
  value,
  delta,
  deltaType,
  format = "number",
  currency = "$",
  subtitle,
  className,
  valueClassName,
  onClick,
}: MetricCardProps) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate(v) {
        setDisplay(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <div className={cn("card p-5", onClick && "cursor-pointer", className)} onClick={onClick}>
      <div className="text-[11px] text-text-secondary font-medium uppercase tracking-wider mb-3">
        {label}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className={cn("text-[26px] font-jetbrains font-semibold text-text-primary leading-none tracking-tight", valueClassName)}>
            {formatDisplay(display, format, currency)}
          </span>
          {subtitle && (
            <span className="text-[12px] font-jetbrains text-text-secondary mt-1">
              {subtitle}
            </span>
          )}
        </div>

        {delta !== undefined && deltaType && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium font-jetbrains pb-0.5",
              deltaType === "up"
                ? "text-accent-emerald"
                : "text-accent-red"
            )}
          >
            {deltaType === "up" ? (
              <TrendingUp size={14} strokeWidth={2} />
            ) : (
              <TrendingDown size={14} strokeWidth={2} />
            )}
            <span>
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
