"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T, index: number) => void;
  loading?: boolean;
  loadingRows?: number;
  rowKey?: (row: T, index: number) => string;
  className?: string;
}

type SortDir = "asc" | "desc";

// ─── Alignment helper ────────────────────────────────────

const alignClass: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

// ─── Skeleton row ────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded bg-white/[0.04] animate-pulse"
            style={{ width: `${50 + Math.random() * 40}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Component ───────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  loading = false,
  loadingRows = 5,
  rowKey,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-subtle bg-bg-card",
        className
      )}
    >
      <table className="w-full text-sm">
        {/* ─── Header ─── */}
        <thead>
          <tr className="border-b border-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted",
                  alignClass[col.align ?? "left"],
                  col.sortable && "cursor-pointer select-none hover:text-text-secondary transition-colors"
                )}
                onClick={
                  col.sortable ? () => handleSort(col.key) : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="inline-flex">
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp size={13} strokeWidth={2} />
                        ) : (
                          <ChevronDown size={13} strokeWidth={2} />
                        )
                      ) : (
                        <ChevronsUpDown
                          size={13}
                          strokeWidth={1.5}
                          className="opacity-40"
                        />
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* ─── Body ─── */}
        <tbody>
          {loading
            ? Array.from({ length: loadingRows }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            : sortedData.map((row, rowIndex) => (
                <tr
                  key={
                    rowKey ? rowKey(row, rowIndex) : String(rowIndex)
                  }
                  onClick={
                    onRowClick
                      ? () => onRowClick(row, rowIndex)
                      : undefined
                  }
                  className={cn(
                    "border-b border-subtle last:border-b-0 transition-colors duration-100",
                    onRowClick &&
                      "cursor-pointer hover:bg-white/[0.02]"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-text-primary",
                        alignClass[col.align ?? "left"]
                      )}
                    >
                      {col.render
                        ? col.render(row, rowIndex)
                        : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}

          {/* Empty state */}
          {!loading && data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-text-muted text-sm"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
