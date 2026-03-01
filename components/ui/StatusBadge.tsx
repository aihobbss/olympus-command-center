"use client";

import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
  variant?: "success" | "warning" | "danger" | "neutral";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles: Record<string, string> = {
  success: "bg-accent-emerald/15 text-accent-emerald ring-accent-emerald/20",
  warning: "bg-accent-amber/15 text-accent-amber ring-accent-amber/20",
  danger: "bg-accent-red/15 text-accent-red ring-accent-red/20",
  neutral: "bg-white/[0.06] text-text-secondary ring-white/[0.06]",
};

const dotColors: Record<string, string> = {
  success: "bg-accent-emerald",
  warning: "bg-accent-amber",
  danger: "bg-accent-red",
  neutral: "bg-text-muted",
};

export function StatusBadge({
  status,
  variant = "neutral",
  size = "sm",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full ring-1 font-medium whitespace-nowrap",
        size === "sm"
          ? "px-2.5 py-0.5 text-[11px]"
          : "px-3 py-1 text-xs",
        variantStyles[variant],
        className
      )}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
          dotColors[variant]
        )}
      />
      {status}
    </span>
  );
}
