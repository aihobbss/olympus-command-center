"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, SlidersHorizontal, Loader2, Sparkles, Eye, X, Upload, Check, ChevronRight, ImageIcon, Table2, Trash2, DollarSign, Tag, Percent, Image as ImageLucide } from "lucide-react";
import { useProductCopyStore, useProductsStore, useStoreContext } from "@/lib/store";
import { type ProductCopy, type AdStatus, type ProductType, type SheetProduct } from "@/data/mock";
import { cn } from "@/lib/utils";

// Sanitize HTML to prevent XSS — only allows safe table/formatting tags
function sanitizeHtml(html: string): string {
  const ALLOWED_TAGS = new Set([
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "b", "strong", "i", "em", "br", "p", "span", "div", "ul", "ol", "li",
  ]);
  // Strip <script>, <iframe>, <object>, <embed>, <form>, <input>, <link>, <style> tags entirely
  let clean = html.replace(/<(script|iframe|object|embed|form|input|link|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Strip self-closing dangerous tags
  clean = clean.replace(/<(script|iframe|object|embed|form|input|link|style)\b[^>]*\/?>/gi, "");
  // Strip event handler attributes (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Strip javascript: URLs
  clean = clean.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "");
  // Strip any remaining tags not in allowlist
  clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : "";
  });
  return clean;
}

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

// ── Link cell (clickable hyperlink + editable) ─────────────────

type LinkCellProps = {
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
};

function LinkCell({ value, placeholder = "—", onSave }: LinkCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    onSave(draft);
  }

  if (!editing) {
    const display = value && value.trim() !== "" ? value : null;
    return (
      <div className="flex items-center gap-1 w-full min-w-0">
        {display ? (
          <>
            <a
              href={display}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-indigo hover:underline truncate flex-1 min-w-0"
              title={display}
              onClick={(e) => e.stopPropagation()}
            >
              {display.replace(/^https?:\/\//, "").split("/products/")[1] || display.replace(/^https?:\/\//, "")}
            </a>
            <button
              onClick={() => {
                setDraft(value ?? "");
                setEditing(true);
              }}
              className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
              title="Edit link"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-white/[0.04] transition-colors duration-100 cursor-text text-text-muted"
          >
            {placeholder}
          </button>
        )}
      </div>
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
          backgroundColor: "var(--bg-elevated)",
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
  onUpdate,
}: {
  product: ProductCopy;
  onClose: () => void;
  onUpdate: (updates: Partial<ProductCopy>) => void;
}) {
  const [shopify, setShopify] = useState(product.shopifyDescription);
  const [facebook, setFacebook] = useState(product.facebookCopy);

  const shopifyChanged = shopify !== product.shopifyDescription;
  const facebookChanged = facebook !== product.facebookCopy;
  const hasChanges = shopifyChanged || facebookChanged;

  function save() {
    const updates: Partial<ProductCopy> = {};
    if (shopifyChanged) updates.shopifyDescription = shopify;
    if (facebookChanged) updates.facebookCopy = facebook;
    if (hasChanges) onUpdate(updates);
    onClose();
  }

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
            <textarea
              value={shopify}
              onChange={(e) => setShopify(e.target.value)}
              placeholder="Not generated yet"
              rows={8}
              className={cn(
                "w-full rounded-lg bg-bg-elevated p-4 text-xs text-text-secondary leading-relaxed",
                "border outline-none resize-y",
                shopifyChanged
                  ? "border-accent-indigo/40"
                  : "border-transparent focus:border-accent-indigo/30"
              )}
            />
          </div>

          <div>
            <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
              Facebook Ad Copy
            </h4>
            <textarea
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="Not generated yet"
              rows={6}
              className={cn(
                "w-full rounded-lg bg-bg-elevated p-4 text-xs text-text-secondary leading-relaxed",
                "border outline-none resize-y",
                facebookChanged
                  ? "border-accent-indigo/40"
                  : "border-transparent focus:border-accent-indigo/30"
              )}
            />
          </div>

          {hasChanges && (
            <div className="flex justify-end">
              <button
                onClick={save}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium",
                  "bg-accent-indigo hover:bg-accent-indigo-hover text-white",
                  "transition-colors duration-150"
                )}
              >
                <Check size={14} />
                Save Changes
              </button>
            </div>
          )}
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
  onTableChange,
}: {
  product: ProductCopy;
  onImageChange: (url: string) => void;
  onGenerate: () => void;
  onTableChange: (html: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState(false);
  const [tableDraft, setTableDraft] = useState(product.sizeChartTable || "");

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          setLocalPreview(dataUrl);
          onImageChange(dataUrl);
        }
      };
      reader.readAsDataURL(file);
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

  // Listen for paste at the document level so Ctrl+V works anywhere when this panel is open
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const preview = localPreview || product.sizeChartImage;

  return (
    <div className="flex gap-6 items-start">
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
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "relative w-[280px] h-[140px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer",
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
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
        )}
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

      {/* Size chart table preview (editable) */}
      {product.sizeChartStatus === "done" && product.sizeChartTable && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
              Generated Table Preview
            </p>
            <button
              onClick={() => {
                setTableDraft(product.sizeChartTable || "");
                setEditingTable(!editingTable);
              }}
              className="text-[11px] text-accent-indigo hover:underline underline-offset-2"
            >
              {editingTable ? "Preview" : "Edit HTML"}
            </button>
          </div>
          {editingTable ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={tableDraft}
                onChange={(e) => setTableDraft(e.target.value)}
                rows={8}
                className={cn(
                  "w-full rounded-lg bg-bg-elevated p-3 text-xs text-text-secondary leading-relaxed font-mono",
                  "border border-accent-indigo/40 outline-none resize-y"
                )}
              />
              {tableDraft !== product.sizeChartTable && (
                <button
                  onClick={() => {
                    onTableChange(tableDraft);
                    setEditingTable(false);
                  }}
                  className={cn(
                    "self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                    "bg-accent-indigo hover:bg-accent-indigo-hover text-white",
                    "transition-colors duration-150"
                  )}
                >
                  <Check size={12} />
                  Save Changes
                </button>
              )}
            </div>
          ) : (
            <div
              className="rounded-lg border border-subtle bg-bg-elevated p-3 overflow-x-auto max-h-[200px] overflow-y-auto text-xs size-chart-preview"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.sizeChartTable) }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Product type options for dropdown ────────────────────────

const PRODUCT_TYPE_OPTIONS: ProductType[] = [
  "",
  "Shoes",
  "Regular Jacket",
  "Light Jacket",
  "Luxury Jacket",
  "Light Sweater",
  "Heavy Sweater",
  "Light Top",
  "Heavy Top",
  "All Accessories",
  "Sandals",
  "Dress",
  "Set",
  "Light Pants",
  "Heavy Pants",
];

// ── Entity fields panel (shown in expanded row) ─────────────

function EntityFieldsPanel({
  entity,
}: {
  entity: SheetProduct | undefined;
}) {
  const updateEntity = useProductsStore.getState().updateSheetProduct;

  // If no matching entity, show a muted message
  if (!entity) {
    return (
      <div className="flex items-center justify-center py-4 text-xs text-text-muted">
        No linked product entity found
      </div>
    );
  }

  const labelClass = "text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1.5";
  const inputClass = cn(
    "w-full text-xs py-1.5 px-2.5 rounded-lg",
    "bg-bg-elevated border border-subtle outline-none",
    "text-text-primary placeholder:text-text-muted",
    "focus:border-accent-indigo/40 transition-colors duration-150",
  );
  const selectStyle = {
    backgroundColor: "var(--bg-elevated)",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
        <Tag size={12} className="text-accent-indigo" />
        Product Entity
      </p>

      {/* Creatives — read-only list */}
      {entity.creativeUrls && entity.creativeUrls.length > 0 && (
        <div>
          <p className={labelClass}>Creatives</p>
          <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto">
            {entity.creativeUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-accent-indigo hover:underline truncate flex items-center gap-1"
                title={url}
              >
                <ImageLucide size={10} className="shrink-0" />
                {url.replace(/^https?:\/\//, "").slice(0, 40)}…
              </a>
            ))}
          </div>
        </div>
      )}

      {/* COG */}
      <div>
        <p className={labelClass}>COG</p>
        <div className="relative">
          <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="number"
            step="0.01"
            value={entity.cog ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseFloat(e.target.value);
              updateEntity(entity.id, { cog: val });
            }}
            placeholder="0.00"
            className={cn(inputClass, "pl-7 font-mono-metric")}
          />
        </div>
      </div>

      {/* Product Type */}
      <div>
        <p className={labelClass}>Product Type</p>
        <select
          value={entity.productType}
          onChange={(e) => updateEntity(entity.id, { productType: e.target.value as ProductType })}
          className={cn(
            inputClass,
            "cursor-pointer appearance-none bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7"
          )}
          style={selectStyle}
        >
          {PRODUCT_TYPE_OPTIONS.map((pt) => (
            <option key={pt || "__empty"} value={pt}>
              {pt || "— Select —"}
            </option>
          ))}
        </select>
      </div>

      {/* Price */}
      <div>
        <p className={labelClass}>Price</p>
        <div className="relative">
          <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="number"
            step="0.01"
            value={entity.pricing ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseFloat(e.target.value);
              updateEntity(entity.id, { pricing: val });
            }}
            placeholder="0.00"
            className={cn(inputClass, "pl-7 font-mono-metric")}
          />
        </div>
      </div>

      {/* Discount % */}
      <div>
        <p className={labelClass}>Discount %</p>
        <div className="relative">
          <Percent size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={entity.discountPercent}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateEntity(entity.id, { discountPercent: val });
            }}
            placeholder="0"
            className={cn(inputClass, "pl-7 font-mono-metric")}
          />
        </div>
      </div>

      {/* Compare At */}
      <div>
        <p className={labelClass}>Compare At</p>
        <div className="relative">
          <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="number"
            step="0.01"
            value={entity.compareAtPrice ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseFloat(e.target.value);
              updateEntity(entity.id, { compareAtPrice: val });
            }}
            placeholder="0.00"
            className={cn(inputClass, "pl-7 font-mono-metric")}
          />
        </div>
      </div>
    </div>
  );
}

// ── Filter types ──────────────────────────────────────────────

type StatusFilter = "All" | "Pending" | "Generating" | "Completed" | "Blank";

// ── Main sheet component ───────────────────────────────────

export function ProductCopySheet() {
  const { copyProducts, loading, loadProducts, updateCopyProduct, deleteCopyProduct, generateCopy, generateAll, pushToStore, pushAllToStore, generateSizeChart } =
    useProductCopyStore();
  const { sheetProducts } = useProductsStore();
  const { selectedStore } = useStoreContext();
  const storeId = selectedStore?.id;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build a lookup map: productId → SheetProduct entity
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const entityMap = useMemo(() => {
    const map = new Map<string, SheetProduct>();
    for (const sp of sheetProducts) {
      map.set(sp.id, sp);
    }
    return map;
  }, [sheetProducts]);

  // Load products from Supabase when store changes
  useEffect(() => {
    if (storeId) {
      loadProducts(storeId).catch((err) =>
        console.error("Failed to load product copies:", err)
      );
    }
  }, [storeId, loadProducts]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 size={24} className="animate-spin text-accent-indigo mb-3" />
        <p className="text-sm text-text-secondary">Loading products…</p>
      </div>
    );
  }

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
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-elevated)",
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
            disabled={copyProducts.some((p) => p.status === "Generating")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              "bg-accent-indigo hover:bg-accent-indigo-hover text-white",
              "shadow-lg shadow-accent-indigo/20 hover:shadow-accent-indigo/30",
              "transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={copyProducts.some((p) => p.pushStatus === "pushing")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              "bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/80 text-white",
              "shadow-lg shadow-[var(--accent-emerald)]/20",
              "transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
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
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[6%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-subtle">
              {[
                "",
                "Ad",
                "Product Name",
                "Store Link",
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

                {/* Store Link */}
                <td className="px-3 py-2.5 overflow-hidden">
                  <LinkCell
                    value={product.productUrl}
                    placeholder="Store link"
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
                    ) : product.sizeChartImage ? (
                      <div
                        className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_1px_rgba(245,158,11,0.4)]"
                        title="Size chart image attached — expand row to generate"
                      />
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

                {/* Preview + Delete */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
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
                    <button
                      onClick={() => deleteCopyProduct(product.id)}
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center",
                        "text-text-muted hover:text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10",
                        "transition-colors duration-150"
                      )}
                      title="Delete product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>

              {/* ── Expanded row: Size Chart + Entity Fields ── */}
              {isExpanded && (
                <tr className="border-b border-subtle/50">
                  <td colSpan={10} className="px-6 py-4 bg-white/[0.01]">
                    <div className="flex gap-8 items-start">
                      {/* Size Chart panel */}
                      <div className="flex-1 min-w-0">
                        <SizeChartPanel
                          product={product}
                          onImageChange={(url) =>
                            updateCopyProduct(product.id, { sizeChartImage: url })
                          }
                          onGenerate={() => generateSizeChart(product.id)}
                          onTableChange={(html) =>
                            updateCopyProduct(product.id, { sizeChartTable: html })
                          }
                        />
                      </div>

                      {/* Entity fields panel */}
                      <div className="w-[220px] flex-shrink-0 border-l border-subtle pl-6">
                        <EntityFieldsPanel
                          entity={product.productId ? entityMap.get(product.productId) : undefined}
                        />
                      </div>
                    </div>
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
          onUpdate={(updates) => updateCopyProduct(previewProduct.id, updates)}
        />
      )}
    </div>
  );
}
