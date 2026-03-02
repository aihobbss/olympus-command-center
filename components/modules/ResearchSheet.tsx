"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, Check, Search, SlidersHorizontal } from "lucide-react";
import { useResearchStore, useStoreContext } from "@/lib/store";
import { type SheetProduct } from "@/data/mock";
import { cn } from "@/lib/utils";

// ── Inline editable text/number cell ───────────────────────

type EditableCellProps = {
  value: string | number | null;
  type?: "text" | "number";
  placeholder?: string;
  prefix?: string;
  onSave: (value: string) => void;
};

function EditableCell({
  value,
  type = "text",
  placeholder = "—",
  prefix,
  onSave,
}: EditableCellProps) {
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
    const display = value != null && value !== "" ? value : null;
    return (
      <button
        onClick={() => {
          setDraft(value?.toString() ?? "");
          setEditing(true);
        }}
        className={cn(
          "w-full text-left text-xs px-2 py-1 rounded",
          "hover:bg-white/[0.04] transition-colors duration-100 cursor-text",
          display != null ? "text-text-primary" : "text-text-muted"
        )}
      >
        {display != null ? (
          <>
            {prefix && <span className="text-text-muted">{prefix}</span>}
            {display}
          </>
        ) : (
          placeholder
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center">
      {prefix && (
        <span className="text-text-muted text-xs pl-2 pr-0.5">{prefix}</span>
      )}
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
          "w-full text-xs py-1 rounded",
          prefix ? "px-1" : "px-2",
          "bg-bg-elevated border border-accent-indigo/40 outline-none",
          "text-text-primary placeholder:text-text-muted"
        )}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Status dropdown / Import button ────────────────────────

const STATUS_OPTIONS: { value: SheetProduct["testingStatus"]; label: string }[] = [
  { value: "Queued", label: "Queued" },
  { value: "Imported", label: "Imported" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Live", label: "Live" },
  { value: "Killed", label: "Killed" },
];

const statusColors: Record<string, string> = {
  Queued: "text-amber-400",
  Imported: "text-sky-400",
  Scheduled: "text-violet-400",
  Live: "text-accent-emerald",
  Killed: "text-accent-red",
};

function StatusCell({
  status,
  onChange,
}: {
  status: SheetProduct["testingStatus"];
  onChange: (s: SheetProduct["testingStatus"]) => void;
}) {
  // Blank status → show Import button
  if (!status) {
    return (
      <button
        onClick={() => onChange("Queued")}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
          "bg-accent-indigo/15 text-accent-indigo",
          "hover:bg-accent-indigo/25 transition-colors duration-150"
        )}
      >
        <Upload size={12} />
        Import
      </button>
    );
  }

  return (
    <select
      value={status}
      onChange={(e) =>
        onChange(e.target.value as SheetProduct["testingStatus"])
      }
      className={cn(
        "text-[11px] font-medium px-2 py-1 rounded-lg",
        "bg-bg-elevated border border-subtle outline-none cursor-pointer",
        "hover:border-[var(--border-hover)] transition-colors duration-150",
        "appearance-none bg-[length:12px] bg-[right_6px_center] bg-no-repeat",
        "pr-6",
        statusColors[status] ?? "text-text-primary"
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      }}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#1A1A24] text-[#F1F1F3]">
          {opt.label}
        </option>
      ))}
    </select>
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

// ── Filter types ──────────────────────────────────────────────

type TestingStatusFilter =
  | "All"
  | "Blank"
  | "Queued"
  | "Imported"
  | "Scheduled"
  | "Live"
  | "Killed";

// ── Main sheet component ───────────────────────────────────

export function ResearchSheet() {
  const { sheetProducts, updateSheetProduct } = useResearchStore();
  const { selectedStore } = useStoreContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestingStatusFilter>("All");

  const filtered = useMemo(() => {
    let items = sheetProducts;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        p.productName.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "All") {
      if (statusFilter === "Blank") {
        items = items.filter((p) => !p.testingStatus);
      } else {
        items = items.filter((p) => p.testingStatus === statusFilter);
      }
    }

    return items;
  }, [sheetProducts, search, statusFilter]);

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
    <div>
      {/* ── Search + Filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
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

        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-text-muted" />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TestingStatusFilter)
            }
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
            <option value="Blank" className="bg-[#1A1A24] text-[#F1F1F3]">Not Imported</option>
            <option value="Queued" className="bg-[#1A1A24] text-[#F1F1F3]">Queued</option>
            <option value="Imported" className="bg-[#1A1A24] text-[#F1F1F3]">Imported</option>
            <option value="Scheduled" className="bg-[#1A1A24] text-[#F1F1F3]">Scheduled</option>
            <option value="Live" className="bg-[#1A1A24] text-[#F1F1F3]">Live</option>
            <option value="Killed" className="bg-[#1A1A24] text-[#F1F1F3]">Killed</option>
          </select>
        </div>

        <span className="text-[11px] text-text-muted font-jetbrains ml-auto">
          {filtered.length} of {sheetProducts.length}
        </span>
      </div>

      {/* ── Table ── */}
    <div className="overflow-x-auto scrollbar-hide -mx-1">
      <table className="w-full min-w-[960px] text-left">
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
              className={cn(
                "border-b border-subtle/50 hover:bg-white/[0.02] transition-colors duration-100",
                product.testingStatus === "Killed" && "opacity-40"
              )}
            >
              {/* Product name — editable */}
              <td className="px-3 py-2.5 min-w-[160px]">
                <EditableCell
                  value={product.productName}
                  placeholder="Product name"
                  onSave={(v) =>
                    updateSheetProduct(product.id, { productName: v })
                  }
                />
              </td>

              {/* Ad link — editable */}
              <td className="px-3 py-2.5 min-w-[100px]">
                <EditableCell
                  value={product.adLink}
                  placeholder="Ad link"
                  onSave={(v) =>
                    updateSheetProduct(product.id, { adLink: v })
                  }
                />
              </td>

              {/* Store link — editable */}
              <td className="px-3 py-2.5 min-w-[100px]">
                <EditableCell
                  value={product.storeLink}
                  placeholder="Not imported"
                  onSave={(v) =>
                    updateSheetProduct(product.id, { storeLink: v })
                  }
                />
              </td>

              {/* Testing status — dropdown or Import button */}
              <td className="px-3 py-2.5">
                <StatusCell
                  status={product.testingStatus}
                  onChange={(s) =>
                    updateSheetProduct(product.id, { testingStatus: s })
                  }
                />
              </td>

              {/* Creative saved — toggle */}
              <td className="px-3 py-2.5">
                <CreativeToggle
                  saved={product.creativeSaved}
                  onChange={(v) =>
                    updateSheetProduct(product.id, { creativeSaved: v })
                  }
                />
              </td>

              {/* COG — editable, always $ */}
              <td className="px-3 py-2.5 w-20">
                <EditableCell
                  value={product.cog}
                  type="number"
                  placeholder="—"
                  prefix="$"
                  onSave={(v) =>
                    updateSheetProduct(product.id, {
                      cog: v ? parseFloat(v) : null,
                    })
                  }
                />
              </td>

              {/* Pricing — editable, store currency */}
              <td className="px-3 py-2.5 w-20">
                <EditableCell
                  value={product.pricing}
                  type="number"
                  placeholder="—"
                  prefix={selectedStore.currency}
                  onSave={(v) =>
                    updateSheetProduct(product.id, {
                      pricing: v ? parseFloat(v) : null,
                    })
                  }
                />
              </td>

              {/* Notes — editable */}
              <td className="px-3 py-2.5 min-w-[160px]">
                <EditableCell
                  value={product.notes}
                  placeholder="Add notes..."
                  onSave={(v) =>
                    updateSheetProduct(product.id, { notes: v })
                  }
                />
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
    </div>
  );
}
