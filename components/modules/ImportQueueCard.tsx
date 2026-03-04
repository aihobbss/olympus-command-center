"use client";

import { X, ExternalLink, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { type SheetProduct } from "@/data/mock";
import { cn } from "@/lib/utils";

interface ImportQueueCardProps {
  product: SheetProduct;
  index: number;
  onRemove: (id: string) => void;
}

export function ImportQueueCard({
  product,
  index,
  onRemove,
}: ImportQueueCardProps) {
  const hasLink = Boolean(product.storeLink);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="card p-4 flex items-center gap-4"
    >
      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {product.productName}
        </p>

        {hasLink ? (
          <a
            href={product.storeLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 mt-1 text-xs text-text-secondary",
              "hover:text-accent-indigo transition-colors duration-150"
            )}
          >
            <span className="font-mono-metric truncate max-w-[320px]">
              {product.storeLink.replace(/^https?:\/\//, "")}
            </span>
            <ExternalLink size={11} className="shrink-0" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 mt-1 text-xs text-[var(--accent-amber)]">
            <AlertTriangle size={11} />
            Missing store link
          </span>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(product.id)}
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          "text-text-muted hover:text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10",
          "transition-colors duration-150"
        )}
        aria-label={`Remove ${product.productName} from queue`}
      >
        <X size={15} />
      </button>
    </motion.div>
  );
}
