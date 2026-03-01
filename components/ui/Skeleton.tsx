"use client";

import React from "react";
import { cn } from "@/lib/utils";

// ─── Base Skeleton ──────────────────────────────────────

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "circle" | "rect";
  style?: React.CSSProperties;
}

export function Skeleton({ className, variant = "text", style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white/[0.04]",
        variant === "circle" && "rounded-full",
        variant === "text" && "h-4 w-full rounded-md",
        variant === "rect" && "rounded-lg",
        className
      )}
      style={style}
    >
      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 60%, transparent 100%)",
          animation: "skeleton-shimmer 1.8s ease-in-out infinite",
        }}
      />

      {/* Global keyframe — rendered once per mount, deduped by the browser */}
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

// ─── SkeletonCard — mirrors MetricCard ──────────────────

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-subtle bg-bg-card p-5",
        className
      )}
    >
      {/* Label area */}
      <Skeleton className="mb-3 h-3 w-24" />

      {/* Value area */}
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

// ─── SkeletonTable — mirrors DataTable ──────────────────

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  // Deterministic widths so the table looks natural without randomness
  const widths = ["65%", "45%", "80%", "55%", "70%", "50%", "75%", "60%"];

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-subtle bg-bg-card",
        className
      )}
    >
      <table className="w-full text-sm">
        {/* Header */}
        <thead>
          <tr className="border-b border-subtle">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-subtle last:border-b-0"
            >
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <Skeleton
                    className="h-4"
                    style={{
                      width:
                        widths[(rowIdx * columns + colIdx) % widths.length],
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SkeletonGrid — grid of SkeletonCards ───────────────

export interface SkeletonGridProps {
  count?: number;
  className?: string;
}

export function SkeletonGrid({ count = 4, className }: SkeletonGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
