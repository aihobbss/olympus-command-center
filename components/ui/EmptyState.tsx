"use client";

import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center py-16",
        className
      )}
    >
      {/* Icon circle */}
      <div className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-white/[0.03] ring-1 ring-white/[0.06]">
        <Icon size={40} className="text-text-muted" />
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-text-primary mt-4">{title}</p>

      {/* Description */}
      <p className="text-xs text-text-muted mt-1.5 max-w-[280px] text-center">
        {description}
      </p>

      {/* Optional action */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 bg-accent-indigo/15 text-accent-indigo text-xs rounded-lg px-3 py-1.5 transition-colors hover:bg-accent-indigo/25"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
