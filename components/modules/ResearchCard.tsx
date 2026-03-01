"use client";

import { motion } from "framer-motion";
import { ExternalLink, FileDown, X } from "lucide-react";
import { type DiscoveryProduct } from "@/data/mock";
import { cn } from "@/lib/utils";

type ResearchCardProps = {
  product: DiscoveryProduct;
  index: number;
  onImport: (id: string) => void;
  onDecline: (id: string) => void;
};

function formatSpend(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

export function ResearchCard({ product, index, onImport, onDecline }: ResearchCardProps) {
  const initials = product.productName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={cn(
        "group rounded-xl border border-subtle bg-bg-card overflow-hidden",
        "hover:border-[var(--border-hover)] transition-colors duration-200"
      )}
    >
      {/* Placeholder creative thumbnail */}
      <div
        className={cn(
          "relative h-36 bg-gradient-to-br flex items-center justify-center",
          product.placeholderGradient
        )}
      >
        <span className="text-white/30 text-4xl font-syne font-bold tracking-widest select-none">
          {initials}
        </span>

        {/* Ad link overlay */}
        <a
          href={product.adLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center",
            "bg-black/30 text-white/70 hover:text-white hover:bg-black/50",
            "transition-colors duration-150 backdrop-blur-sm"
          )}
          title="View ad"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-syne font-bold text-sm text-text-primary mb-3 truncate">
          {product.productName}
        </h3>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <MetricPill label="Spend" value={formatSpend(product.spend)} />
          <MetricPill label="Active Ads" value={String(product.activeAds)} />
          <MetricPill label="Last Seen" value={product.lastSeen} />
          <MetricPill label="Brands" value={String(product.brandsRunning)} />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onImport(product.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              "bg-accent-indigo/15 text-accent-indigo",
              "hover:bg-accent-indigo/25 transition-colors duration-150"
            )}
          >
            <FileDown size={13} />
            Import to Sheet
          </button>
          <button
            onClick={() => onDecline(product.id)}
            className={cn(
              "w-9 flex items-center justify-center rounded-lg",
              "text-text-muted hover:text-accent-red hover:bg-accent-red/10",
              "transition-colors duration-150"
            )}
            title="Decline"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-elevated px-2.5 py-1.5">
      <div className="text-[10px] text-text-muted leading-tight">{label}</div>
      <div className="text-xs font-jetbrains font-semibold text-text-primary leading-tight mt-0.5">
        {value}
      </div>
    </div>
  );
}
