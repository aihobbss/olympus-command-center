"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, SlidersHorizontal, Loader2, Sparkles, Eye, X, Upload, Check, ChevronRight, ImageIcon, Table2 } from "lucide-react";
import { useProductCopyStore } from "@/lib/store";
import { type ProductCopy, type AdStatus } from "@/data/mock";
import { cn } from "@/lib/utils";

// ── Inline editable text cell ───────────────────────────────

type EditableCellProps = {
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (value: string) => void;
};

function EditableCell({
  value,
  placeholder = "—",
  multiline = false,
  onSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      if (multiline) textareaRef.current?.focus();
      else inputRef.current?.focus();
    }
  }, [editing, multiline]);

  function commit() {
    setEditing(false);
    onSave(draft);
  }

  if (!editing) {
    const display = value && value.trim() !== "" ? value : null;
    return (
      <button
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        className={cn(
          "w-full text-left text-xs px-2 py-1 rounded",
          "hover:bg-white/[0.04] transition-colors duration-100 cursor-text truncate block",
          display != null ? "text-text-primary" : "text-text-muted",
          multiline && display && "line-clamp-2"
        )}
        title={display ?? undefined}
      >
        {display ?? placeholder}
      </button>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        rows={4}
        className={cn(
          "w-full text-xs py-1 px-2 rounded",
          "bg-bg-elevated border border-accent-indigo/40 outline-none",
          "text-text-primary placeholder:text-text-muted resize-y"
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className={cn(
        "w-full text-xs py-1 px-2 rounded",
        "bg-bg-elevated border border-accent-indigo/40 outline-none",
        "text-text-primary placeholder:text-text-muted"
      )}
      placeholder={placeholder}
    />
  );
}

// ── Ad status dot ──────────────────────────────────────────────

const adStatusConfig: Record<AdStatus, { color: string; glow: string; label: string }> = {
  red: {
    color: "bg-red-500",
    glow: "shadow-[0_0_6px_1px_rgba(239,68,68,0.45)]",
    label: "Off",
  },
  yellow: {
    color: "bg-amber-400",
    glow: "shadow-[0_0_6px_1px_rgba(245,158,11,0.45)]",
    label: "Paused",
  },
  green: {
    color: "bg-emerald-400",
    glow: "shadow-[0_0_6px_1px_rgba(16,185,129,0.45)]",
    label: "Live",
  },
};

function AdStatusDot({
  status,
  onChange,
}: {
  status: AdStatus;
  onChange: (s: AdStatus) => void;
}) {
  const cfg = adStatusConfig[status];
  const cycle: AdStatus[] = ["red", "yellow", "green"];
  const next = cycle[(cycle.indexOf(status) + 1) % cycle.length];

  return (
    <button
      onClick={() => onChange(next)}
      className="flex items-center justify-center w-full"
      title={cfg.label}
    >
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          cfg.color,
          cfg.glow,
          "transition-all duration-200"
        )}
      />
    </button>
  );
}

// ── Status cell with Generate button ──────────────────────────

const statusColors: Record<string, string> = {
  Pending: "text-amber-400",
  Generating: "text-violet-400",
  Completed: "text-accent-emerald",
};

function CopyStatusCell({
  status,
  onGenerate,
  onChange,
  pushState,
  onPush,
}: {
  status: ProductCopy["status"];
  onGenerate: () => void;
  onChange: (s: ProductCopy["status"]) => void;
  pushState: "idle" | "pushing" | "pushed";
  onPush: () => void;
}) {
  if (!status || status === "Pending") {
    return (
      <button
        onClick={onGenerate}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
          "bg-accent-indigo/15 text-accent-indigo",
          "hover:bg-accent-indigo/25 transition-colors duration-150"
        )}
      >
        <Sparkles size={12} />
        Generate
      </button>
    );
  }

  if (status === "Generating") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-400">
        <Loader2 size={12} className="animate-spin" />
        Generating…
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as ProductCopy["status"])}
        className={cn(
          "text-[11px] font-medium px-2 py-1 rounded-lg",
          "bg-bg-elevated border border-subtle outline-none cursor-pointer",
          "hover:border-[var(--border-hover)] transition-colors duration-150",
          "appearance-none bg-[length:12px] bg-[right_6px_center] bg-no-repeat pr-6",
          statusColors[status] ?? "text-text-primary"
        )}
        style={{
          backgroundColor: "#1A1A24",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        }}
      >
        <option value="Pending">Pending</option>
        <option value="Completed">Completed</option>
      </select>

      {pushState === "pushing" ? (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-400">
          <Loader2 size={12} className="animate-spin" />
          Pushing…
        </span>
      ) : pushState === "pushed" ? (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent-emerald)]">
          <Check size={12} />
          Pushed
        </span>
      ) : (
        <button
          onClick={onPush}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
            "bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]",
            "hover:bg-[var(--accent-emerald)]/25 transition-colors duration-150"
          )}
        >
          <Upload size={12} />
          Push to Store
        </button>
      )}
    </div>
  );
}

// ── Copy preview modal ──────────────────────────────────────

function CopyPreviewModal({
  product,
  onClose,
}: {
  product: ProductCopy;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-subtle bg-bg-card p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
        >
          <X size={16} />
        </button>

        <h3 className="font-syne font-bold text-lg text-text-primary mb-6">
          {product.productName}
        </h3>

        <div className="space-y-6">
          <div>
            <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
              Shopify Description
            </h4>
            <div className="rounded-lg bg-bg-elevated p-4 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
              {product.shopifyDescription || "Not generated yet"}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
              Facebook Ad Copy
            </h4>
            <div className="rounded-lg bg-bg-elevated p-4 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
              {product.facebookCopy || "Not generated yet"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Size chart panel (shown in expanded row) ─────────────────

function SizeChartPanel({
  product,
  onImageChange,
  onGenerate,
}: {
  product: ProductCopy;
  onImageChange: (url: string) => void;
  onGenerate: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setLocalPreview(url);
      onImageChange(url);
    },
    [onImageChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    },
    [handleFile]
  );

  const preview = localPreview || product.sizeChartImage;

  return (
    <div className="flex gap-6 items-start" onPaste={handlePaste}>
      {/* Upload area */}
      <div className="flex-shrink-0">
        <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
          Size Chart Image
        </p>
        {preview ? (
          <div className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Size chart"
              className="rounded-lg border border-subtle max-w-[280px] max-h-[200px] object-contain bg-bg-elevated"
            />
            <button
              onClick={() => {
                setLocalPreview(null);
                onImageChange("");
              }}
              className={cn(
                "absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center",
                "bg-bg-card border border-subtle text-text-muted hover:text-text-primary",
                "opacity-0 group-hover:opacity-100 transition-opacity"
              )}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "w-[280px] h-[140px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2",
              "transition-colors duration-150",
              dragOver
                ? "border-accent-indigo/60 bg-accent-indigo/5"
                : "border-subtle hover:border-text-muted/30 bg-bg-elevated/50"
            )}
          >
            <ImageIcon size={20} className="text-text-muted" />
            <span className="text-[11px] text-text-muted">
              Drop screenshot, paste, or click to upload
            </span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Generate button + status */}
      <div className="flex flex-col gap-3 pt-6">
        {product.sizeChartStatus === "generating" ? (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-violet-400">
            <Loader2 size={14} className="animate-spin" />
            Converting to table…
          </span>
        ) : product.sizeChartStatus === "done" ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-emerald)]">
              <Check size={14} />
              Size chart ready
            </span>
            {preview && (
              <button
                onClick={onGenerate}
                className={cn(
                  "text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2",
                  "transition-colors duration-150"
                )}
              >
                Regenerate
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onGenerate}
            disabled={!preview}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              "transition-colors duration-150",
              preview
                ? "bg-accent-indigo/15 text-accent-indigo hover:bg-accent-indigo/25"
                : "bg-white/[0.03] text-text-muted cursor-not-allowed"
            )}
          >
            <Table2 size={14} />
            Generate Table
          </button>
        )}
        <p className="text-[10px] text-text-muted max-w-[200px] leading-relaxed">
          Converts your size chart screenshot into an HTML table that gets included with the Shopify description when pushed to store.
        </p>
      </div>
    </div>
  );
}

// ── Filter types ──────────────────────────────────────────────

type StatusFilter = "All" | "Pending" | "Generating" | "Completed" | "Blank";

// ── Main sheet component ───────────────────────────────────

export function ProductCopySheet() {
  const { copyProducts, updateCopyProduct, generateCopy, generateAll, pushToStore, pushAllToStore, generateSizeChart } =
    useProductCopyStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = copyProducts;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        p.productName.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      if (statusFilter === "Blank") {
        items = items.filter((p) => !p.status);
      } else {
        items = items.filter((p) => p.status === statusFilter);
      }
    }

    return items;
  }, [copyProducts, search, statusFilter]);

  const previewProduct = previewId
    ? copyProducts.find((p) => p.id === previewId)
    : null;

  if (copyProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center mb-4">
          <Sparkles size={20} className="text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary mb-1">
          No products for copy generation yet
        </p>
        <p className="text-xs text-text-muted">
          Import products via Kopy to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Search + Filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className={cn(
              "w-full pl-9 pr-3 py-2 rounded-lg text-xs",
              "bg-bg-elevated border border-subtle outline-none",
              "text-text-primary placeholder:text-text-muted",
              "focus:border-accent-indigo/40 transition-colors duration-150"
            )}
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-text-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={cn(
              "text-xs px-3 py-2 rounded-lg",
              "bg-bg-elevated border border-subtle outline-none cursor-pointer",
              "text-text-primary",
              "hover:border-[var(--border-hover)] transition-colors duration-150",
              "appearance-none bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7"
            )}
            style={{
              color: "#F1F1F3",
              backgroundColor: "#1A1A24",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            }}
          >
            <option value="All">All Status</option>
            <option value="Blank">No Status</option>
            <option value="Pending">Pending</option>
            <option value="Generating">Generating</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {/* Generate All button */}
        {copyProducts.some((p) => p.status === "" || p.status === "Pending") && (
          <button
            onClick={generateAll}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              "bg-accent-indigo hover:bg-accent-indigo-hover text-white",
              "shadow-lg shadow-accent-indigo/20 hover:shadow-accent-indigo/30",
              "transition-all duration-200"
            )}
          >
            <Sparkles size={14} />
            Generate All
          </button>
        )}

        {/* Push All to Store button */}
        {copyProducts.some(
          (p) => p.status === "Completed" && p.pushStatus === ""
        ) && (
          <button
            onClick={pushAllToStore}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              "bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/80 text-white",
              "shadow-lg shadow-[var(--accent-emerald)]/20",
              "transition-all duration-200"
            )}
          >
            <Upload size={14} />
            Push All to Store
          </button>
        )}

        {/* Count */}
        <span className="text-[11px] text-text-muted font-jetbrains ml-auto">
          {filtered.length} of {copyProducts.length}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto scrollbar-hide -mx-1">
        <table className="w-full min-w-[1200px] text-left table-fixed">
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[3%]" />
            <col className="w-[12%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[6%]" />
            <col className="w-[12%]" />
            <col className="w-[4%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-subtle">
              {[
                "",
                "Ad",
                "Product Name",
                "Product URL",
                "Image URL",
                "Shopify",
                "Facebook",
                "Size Chart",
                "Status",
                "",
              ].map((h) => (
                <th
                  key={h || "expand"}
                  className="px-3 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const isExpanded = expandedId === product.id;
              return (
              <React.Fragment key={product.id}>
              <tr
                className="border-b border-subtle/50 hover:bg-white/[0.02] transition-colors duration-100"
              >
                {/* Expand chevron */}
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : product.id)}
                    className="flex items-center justify-center w-full text-text-muted hover:text-text-primary transition-colors"
                  >
                    <ChevronRight
                      size={14}
                      className={cn(
                        "transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>
                </td>

                {/* Ad status dot */}
                <td className="px-3 py-2.5">
                  <AdStatusDot
                    status={product.adStatus}
                    onChange={(s) =>
                      updateCopyProduct(product.id, { adStatus: s })
                    }
                  />
                </td>

                {/* Product Name */}
                <td className="px-3 py-2.5 overflow-hidden">
                  <EditableCell
                    value={product.productName}
                    placeholder="Product name"
                    onSave={(v) =>
                      updateCopyProduct(product.id, { productName: v })
                    }
                  />
                </td>

                {/* Product URL */}
                <td className="px-3 py-2.5 overflow-hidden">
                  <EditableCell
                    value={product.productUrl}
                    placeholder="Product URL"
                    onSave={(v) =>
                      updateCopyProduct(product.id, { productUrl: v })
                    }
                  />
                </td>

                {/* Image URL */}
                <td className="px-3 py-2.5 overflow-hidden">
                  <EditableCell
                    value={product.imageUrl}
                    placeholder="Image URL"
                    onSave={(v) =>
                      updateCopyProduct(product.id, { imageUrl: v })
                    }
                  />
                </td>

                {/* Shopify Description */}
                <td className="px-3 py-2.5 overflow-hidden">
                  <EditableCell
                    value={product.shopifyDescription}
                    placeholder="Generate to fill..."
                    multiline
                    onSave={(v) =>
                      updateCopyProduct(product.id, {
                        shopifyDescription: v,
                      })
                    }
                  />
                </td>

                {/* Facebook Copy */}
                <td className="px-3 py-2.5 overflow-hidden">
                  <EditableCell
                    value={product.facebookCopy}
                    placeholder="Generate to fill..."
                    multiline
                    onSave={(v) =>
                      updateCopyProduct(product.id, { facebookCopy: v })
                    }
                  />
                </td>

                {/* Size Chart indicator */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center">
                    {product.sizeChartStatus === "generating" ? (
                      <Loader2 size={14} className="animate-spin text-violet-400" />
                    ) : product.sizeChartStatus === "done" ? (
                      <div className="flex items-center gap-1.5 text-[var(--accent-emerald)]">
                        <Check size={14} />
                        <span className="text-[11px] font-medium">Done</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-text-muted">—</span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  <CopyStatusCell
                    status={product.status}
                    onGenerate={() => generateCopy(product.id)}
                    onChange={(s) =>
                      updateCopyProduct(product.id, { status: s })
                    }
                    pushState={
                      product.pushStatus === "pushing"
                        ? "pushing"
                        : product.pushStatus === "pushed"
                          ? "pushed"
                          : "idle"
                    }
                    onPush={() => pushToStore(product.id)}
                  />
                </td>

                {/* Preview button (for completed) */}
                <td className="px-3 py-2.5">
                  {(product.shopifyDescription || product.facebookCopy) && (
                    <button
                      onClick={() => setPreviewId(product.id)}
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center",
                        "text-text-muted hover:text-text-primary hover:bg-white/[0.06]",
                        "transition-colors duration-150"
                      )}
                      title="Preview copy"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </td>
              </tr>

              {/* ── Expanded row: Size Chart upload ── */}
              {isExpanded && (
                <tr className="border-b border-subtle/50">
                  <td colSpan={10} className="px-6 py-4 bg-white/[0.01]">
                    <SizeChartPanel
                      product={product}
                      onImageChange={(url) =>
                        updateCopyProduct(product.id, { sizeChartImage: url })
                      }
                      onGenerate={() => generateSizeChart(product.id)}
                    />
                  </td>
                </tr>
              )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-text-secondary mb-1">No matching products</p>
          <p className="text-xs text-text-muted">
            Try adjusting your search or filter
          </p>
        </div>
      )}

      {/* Preview modal */}
      {previewProduct && (
        <CopyPreviewModal
          product={previewProduct}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}
