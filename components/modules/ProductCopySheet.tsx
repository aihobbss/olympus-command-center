"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, SlidersHorizontal, Loader2, Sparkles, Eye, X } from "lucide-react";
import { useProductCopyStore } from "@/lib/store";
import { type ProductCopy } from "@/data/mock";
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
}: {
  status: ProductCopy["status"];
  onGenerate: () => void;
  onChange: (s: ProductCopy["status"]) => void;
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
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      }}
    >
      <option value="Pending" className="bg-[#1A1A24] text-[#F1F1F3]">Pending</option>
      <option value="Completed" className="bg-[#1A1A24] text-[#F1F1F3]">Completed</option>
    </select>
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

// ── Filter types ──────────────────────────────────────────────

type StatusFilter = "All" | "Pending" | "Generating" | "Completed" | "Blank";

// ── Main sheet component ───────────────────────────────────

export function ProductCopySheet() {
  const { copyProducts, updateCopyProduct, generateCopy } =
    useProductCopyStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [previewId, setPreviewId] = useState<string | null>(null);

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
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            }}
          >
            <option value="All" className="bg-[#1A1A24] text-[#F1F1F3]">All Status</option>
            <option value="Blank" className="bg-[#1A1A24] text-[#F1F1F3]">No Status</option>
            <option value="Pending" className="bg-[#1A1A24] text-[#F1F1F3]">Pending</option>
            <option value="Generating" className="bg-[#1A1A24] text-[#F1F1F3]">Generating</option>
            <option value="Completed" className="bg-[#1A1A24] text-[#F1F1F3]">Completed</option>
          </select>
        </div>

        {/* Count */}
        <span className="text-[11px] text-text-muted font-jetbrains ml-auto">
          {filtered.length} of {copyProducts.length}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto scrollbar-hide -mx-1">
        <table className="w-full min-w-[1100px] text-left table-fixed">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
            <col className="w-[12%]" />
            <col className="w-[4%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-subtle">
              {[
                "Product Name",
                "Product URL",
                "Image URL",
                "Shopify",
                "Facebook",
                "Status",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr
                key={product.id}
                className="border-b border-subtle/50 hover:bg-white/[0.02] transition-colors duration-100"
              >
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

                {/* Status */}
                <td className="px-3 py-2.5">
                  <CopyStatusCell
                    status={product.status}
                    onGenerate={() => generateCopy(product.id)}
                    onChange={(s) =>
                      updateCopyProduct(product.id, { status: s })
                    }
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
            ))}
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
