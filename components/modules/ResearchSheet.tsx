"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Upload, Check } from "lucide-react";
import { useResearchStore } from "@/lib/store";
import { type SheetProduct } from "@/data/mock";
import { cn } from "@/lib/utils";

// ── Status badge for the sheet ─────────────────────────────

const statusConfig: Record<
  SheetProduct["testingStatus"],
  { label: string; variant: string }
> = {
  "": { label: "—", variant: "text-text-muted" },
  Queued: { label: "Queued", variant: "text-amber-400 bg-amber-400/10" },
  Imported: { label: "Imported", variant: "text-sky-400 bg-sky-400/10" },
  Scheduled: { label: "Scheduled", variant: "text-violet-400 bg-violet-400/10" },
  Live: { label: "Live", variant: "text-accent-emerald bg-accent-emerald/10" },
  Killed: { label: "Killed", variant: "text-accent-red bg-accent-red/10" },
};

function SheetStatusBadge({ status }: { status: SheetProduct["testingStatus"] }) {
  const cfg = statusConfig[status];
  if (!status) return <span className="text-text-muted text-xs">—</span>;
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", cfg.variant)}>
      {cfg.label}
    </span>
  );
}

// ── Inline editable cell ───────────────────────────────────

type EditableCellProps = {
  value: string | number | null;
  type?: "text" | "number";
  placeholder?: string;
  onSave: (value: string) => void;
};

function EditableCell({ value, type = "text", placeholder = "—", onSave }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    onSave(draft);
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value?.toString() ?? "");
          setEditing(true);
        }}
        className={cn(
          "w-full text-left text-xs px-2 py-1 rounded",
          "hover:bg-white/[0.04] transition-colors duration-100 cursor-text",
          value != null && value !== "" ? "text-text-primary" : "text-text-muted"
        )}
      >
        {value != null && value !== "" ? value : placeholder}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className={cn(
        "w-full text-xs px-2 py-1 rounded",
        "bg-bg-elevated border border-accent-indigo/40 outline-none",
        "text-text-primary placeholder:text-text-muted"
      )}
      placeholder={placeholder}
    />
  );
}

// ── Creative saved toggle ──────────────────────────────────

function CreativeToggle({
  saved,
  onChange,
}: {
  saved: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!saved)}
      className={cn(
        "w-5 h-5 rounded border flex items-center justify-center transition-colors duration-150",
        saved
          ? "bg-accent-indigo/20 border-accent-indigo/50 text-accent-indigo"
          : "border-subtle text-transparent hover:border-text-muted"
      )}
    >
      <Check size={12} strokeWidth={3} />
    </button>
  );
}

// ── Main sheet component ───────────────────────────────────

export function ResearchSheet() {
  const { sheetProducts, updateSheetProduct, queueForImport } = useResearchStore();

  if (sheetProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center mb-4">
          <Upload size={20} className="text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary mb-1">No products on the sheet yet</p>
        <p className="text-xs text-text-muted">
          Import products from the Discover tab to get started
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-hide -mx-1">
      <table className="w-full min-w-[900px] text-left">
        <thead>
          <tr className="border-b border-subtle">
            {[
              "Product Name",
              "Ad Link",
              "Store Link",
              "Status",
              "Creative",
              "COG",
              "Price",
              "Notes",
              "Actions",
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
          {sheetProducts.map((product) => (
            <tr
              key={product.id}
              className={cn(
                "border-b border-subtle/50 hover:bg-white/[0.02] transition-colors duration-100",
                product.testingStatus === "Killed" && "opacity-40"
              )}
            >
              {/* Product name */}
              <td className="px-3 py-2.5">
                <span className="text-sm font-medium text-text-primary">
                  {product.productName}
                </span>
              </td>

              {/* Ad link */}
              <td className="px-3 py-2.5">
                <a
                  href={product.adLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-indigo hover:text-accent-indigo/80 transition-colors"
                >
                  <ExternalLink size={12} />
                  View
                </a>
              </td>

              {/* Store link */}
              <td className="px-3 py-2.5">
                {product.storeLink ? (
                  <a
                    href={product.storeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent-emerald hover:text-accent-emerald/80 transition-colors"
                  >
                    <ExternalLink size={12} />
                    Store
                  </a>
                ) : (
                  <span className="text-xs text-text-muted">Not imported</span>
                )}
              </td>

              {/* Testing status */}
              <td className="px-3 py-2.5">
                <SheetStatusBadge status={product.testingStatus} />
              </td>

              {/* Creative saved */}
              <td className="px-3 py-2.5">
                <CreativeToggle
                  saved={product.creativeSaved}
                  onChange={(v) =>
                    updateSheetProduct(product.id, { creativeSaved: v })
                  }
                />
              </td>

              {/* COG — inline editable */}
              <td className="px-3 py-2.5 w-20">
                <EditableCell
                  value={product.cog}
                  type="number"
                  placeholder="—"
                  onSave={(v) =>
                    updateSheetProduct(product.id, {
                      cog: v ? parseFloat(v) : null,
                    })
                  }
                />
              </td>

              {/* Pricing — inline editable */}
              <td className="px-3 py-2.5 w-20">
                <EditableCell
                  value={product.pricing}
                  type="number"
                  placeholder="—"
                  onSave={(v) =>
                    updateSheetProduct(product.id, {
                      pricing: v ? parseFloat(v) : null,
                    })
                  }
                />
              </td>

              {/* Notes — inline editable */}
              <td className="px-3 py-2.5 min-w-[160px]">
                <EditableCell
                  value={product.notes}
                  placeholder="Add notes..."
                  onSave={(v) =>
                    updateSheetProduct(product.id, { notes: v })
                  }
                />
              </td>

              {/* Actions */}
              <td className="px-3 py-2.5">
                {!product.testingStatus && (
                  <button
                    onClick={() => queueForImport(product.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
                      "bg-accent-indigo/15 text-accent-indigo",
                      "hover:bg-accent-indigo/25 transition-colors duration-150"
                    )}
                  >
                    <Upload size={12} />
                    Queue Import
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
