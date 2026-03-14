"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Upload,
  Search,
  SlidersHorizontal,
  ExternalLink,
  PackageCheck,
  Plus,
  Loader2,
  Image,
  Trash2,
} from "lucide-react";
import { useResearchStore, useStoreContext } from "@/lib/store";
import {
  type SheetProduct,
  type ProductType,
  getPriceForType,
  getDiscountForPrice,
} from "@/data/mock";
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

// ── Link cell — clickable hyperlink + editable ──────────────

function LinkCell({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    onSave(draft);
  }

  if (editing) {
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

  if (!value) {
    return (
      <button
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="w-full text-left text-xs px-2 py-1 rounded text-text-muted hover:bg-white/[0.04] transition-colors duration-100 cursor-text"
      >
        {placeholder}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent-indigo hover:text-accent-indigo/80 truncate max-w-[140px] transition-colors duration-100"
        title={value}
      >
        {(() => {
          try {
            const url = new URL(value);
            return url.hostname.replace("www.", "");
          } catch {
            return value.slice(0, 24);
          }
        })()}
      </a>
      <ExternalLink
        size={11}
        className="text-text-muted opacity-0 group-hover:opacity-100 shrink-0 transition-opacity duration-100"
      />
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="text-text-muted opacity-0 group-hover:opacity-100 text-[10px] hover:text-text-secondary shrink-0 transition-opacity duration-100"
        title="Edit"
      >
        edit
      </button>
    </div>
  );
}

// ── Product type selector (drives pricing) ──────────────────

const PRODUCT_TYPES: ProductType[] = [
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

function ProductTypeCell({
  productType,
  market,
  onChange,
}: {
  productType: ProductType;
  market: string;
  onChange: (pt: ProductType, price: number | null, discount: number) => void;
}) {
  return (
    <select
      value={productType}
      onChange={(e) => {
        const pt = e.target.value as ProductType;
        const price = getPriceForType(pt, market);
        const discount = price != null ? getDiscountForPrice(price, market) : 42;
        onChange(pt, price, discount);
      }}
      className={cn(
        "text-[11px] font-medium px-2 py-1 rounded-lg",
        "bg-bg-elevated border border-subtle outline-none cursor-pointer",
        "hover:border-[var(--border-hover)] transition-colors duration-150",
        "appearance-none bg-[length:12px] bg-[right_6px_center] bg-no-repeat",
        "pr-6",
        productType ? "text-text-primary" : "text-text-muted"
      )}
      style={{
        backgroundColor: "#1A1A24",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      }}
    >
      <option value="">Select type</option>
      {PRODUCT_TYPES.filter((t) => t !== "").map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
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
        backgroundColor: "#1A1A24",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      }}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
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
  const { sheetProducts, updateSheetProduct, importAllUnimported, addSheetProduct, deleteSheetProduct, loadProducts, loading } =
    useResearchStore();
  const { selectedStore } = useStoreContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestingStatusFilter>("All");
  const [scrapingIds, setScrapingIds] = useState<Set<string>>(new Set());

  // Load products from Supabase when store changes
  const storeId = selectedStore?.id;
  useEffect(() => {
    if (storeId) {
      loadProducts(storeId);
    }
  }, [storeId, loadProducts]);

  // Auto-fill product data when an afterlib/winninghunter link is pasted
  const handleAdLinkSave = useCallback(
    async (productId: string, link: string) => {
      // Always save the link itself
      updateSheetProduct(productId, { adLink: link });

      // Only attempt scrape for recognized URLs
      if (
        !link ||
        (!link.includes("afterlib.com") && !link.includes("winninghunter.com"))
      ) {
        return;
      }

      setScrapingIds((prev) => new Set(prev).add(productId));

      try {
        const res = await fetch(
          `/api/scrape-ad?url=${encodeURIComponent(link)}`
        );
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.error("Scrape failed:", res.status, errBody);
          return;
        }
        const data = await res.json();

        // Read latest state directly from Zustand to avoid stale closure
        const currentProducts = useResearchStore.getState().sheetProducts;
        const product = currentProducts.find((p) => p.id === productId);
        if (!product) {
          console.error("Product not found after scrape:", productId);
          return;
        }

        const updates: Partial<typeof product> = {};
        if (!product.productName && data.productName)
          updates.productName = data.productName;
        if (!product.storeLink && data.storeLink)
          updates.storeLink = data.storeLink;
        if (data.creatives?.length > 0 && product.creativeUrls.length === 0)
          updates.creativeUrls = data.creatives;
        if (!product.notes && data.adCopy)
          updates.notes = data.adCopy.replace(/<br\s*\/?>/gi, "\n").slice(0, 200);

        if (Object.keys(updates).length > 0) {
          updateSheetProduct(productId, updates);
        }
      } catch (err) {
        console.error("Scrape error for", link, err);
      } finally {
        setScrapingIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [updateSheetProduct]
  );

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

  const unimportedCount = useMemo(
    () => sheetProducts.filter((p) => !p.testingStatus).length,
    [sheetProducts]
  );

  if (!selectedStore) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-8 h-8 border-2 border-accent-indigo/30 border-t-accent-indigo rounded-full animate-spin mb-4" />
        <p className="text-sm text-text-secondary">Loading products...</p>
      </div>
    );
  }

  // No empty-state gate — always show the table with Add Product button

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
              color: "#F1F1F3",
              backgroundColor: "#1A1A24",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            }}
          >
            <option value="All">All Status</option>
            <option value="Blank">Not Imported</option>
            <option value="Queued">Queued</option>
            <option value="Imported">Imported</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Live">Live</option>
            <option value="Killed">Killed</option>
          </select>
        </div>

        {/* Import All button */}
        {unimportedCount > 0 && (
          <button
            onClick={importAllUnimported}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              "bg-accent-indigo hover:bg-accent-indigo-hover text-white",
              "shadow-lg shadow-accent-indigo/20 hover:shadow-accent-indigo/30",
              "transition-all duration-200"
            )}
          >
            <PackageCheck size={14} />
            Import All ({unimportedCount})
          </button>
        )}

        <span className="text-[11px] text-text-muted font-jetbrains ml-auto">
          {filtered.length} of {sheetProducts.length}
        </span>
      </div>

      {/* ── Table ── */}
    <div className="overflow-x-auto scrollbar-hide -mx-1">
      <table className="w-full min-w-[1320px] text-left">
        <thead>
          <tr className="border-b border-subtle">
            {[
              "Product Name",
              "Ad Link",
              "Store Link",
              "Creatives",
              "Status",
              "COG",
              "Type",
              "Price",
              "Discount %",
              "Compare At",
              "Notes",
            ].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-[11px] font-medium text-text-muted uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
            <th className="px-2 py-2.5 w-8" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((product) => (
            <tr
              key={product.id}
              className={cn(
                "group border-b border-subtle/50 hover:bg-white/[0.02] transition-colors duration-100",
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

              {/* Ad link — clickable hyperlink + auto-fill */}
              <td className="px-3 py-2.5 min-w-[120px]">
                {scrapingIds.has(product.id) ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-violet-400">
                    <Loader2 size={12} className="animate-spin" />
                    Fetching…
                  </span>
                ) : (
                <LinkCell
                  value={product.adLink}
                  placeholder="Ad link"
                  onSave={(v) => handleAdLinkSave(product.id, v)}
                />
                )}
              </td>

              {/* Store link — clickable hyperlink */}
              <td className="px-3 py-2.5 min-w-[120px]">
                <LinkCell
                  value={product.storeLink}
                  placeholder="Not imported"
                  onSave={(v) =>
                    updateSheetProduct(product.id, { storeLink: v })
                  }
                />
              </td>

              {/* Creatives — thumbnail previews of scraped media */}
              <td className="px-3 py-2.5 min-w-[100px]">
                {product.creativeUrls.length > 0 ? (
                  <div className="flex items-center gap-1">
                    {product.creativeUrls.slice(0, 3).map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-8 h-8 rounded border border-subtle overflow-hidden hover:border-accent-indigo/40 transition-colors shrink-0"
                        title={url}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Creative ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </a>
                    ))}
                    {product.creativeUrls.length > 3 && (
                      <span className="text-[10px] text-text-muted">
                        +{product.creativeUrls.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <Image size={12} />
                    —
                  </span>
                )}
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

              {/* Product Type — dropdown, drives pricing */}
              <td className="px-3 py-2.5">
                <ProductTypeCell
                  productType={product.productType}
                  market={selectedStore.market}
                  onChange={(pt, price, discount) =>
                    updateSheetProduct(product.id, {
                      productType: pt,
                      pricing: price,
                      discountPercent: discount,
                    })
                  }
                />
              </td>

              {/* Pricing — derived from product type + current store market */}
              {(() => {
                const marketPrice = getPriceForType(product.productType, selectedStore.market);
                const discount = marketPrice != null
                  ? getDiscountForPrice(marketPrice, selectedStore.market)
                  : product.discountPercent;
                const compareAt = marketPrice != null
                  ? Math.ceil(marketPrice / (1 - discount / 100))
                  : null;
                return (
                  <>
                    <td className="px-3 py-2.5 w-20">
                      <span
                        className={cn(
                          "text-xs font-mono-metric px-2 py-1",
                          marketPrice != null ? "text-text-primary" : "text-text-muted"
                        )}
                      >
                        {marketPrice != null ? (
                          <>
                            <span className="text-text-muted">{selectedStore.currency}</span>
                            {marketPrice}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </td>

                    {/* Discount % — editable override */}
                    <td className="px-3 py-2.5 w-20">
                      <span className="text-xs font-mono-metric px-2 py-1 text-text-primary">
                        {discount}%
                      </span>
                    </td>

                    {/* Compare At — auto-calculated from market price & discount */}
                    <td className="px-3 py-2.5 w-24">
                      <span
                        className={cn(
                          "text-xs font-mono-metric px-2 py-1",
                          compareAt != null ? "text-text-secondary line-through" : "text-text-muted"
                        )}
                      >
                        {compareAt != null ? (
                          <>
                            <span className="text-text-muted">{selectedStore.currency}</span>
                            {compareAt}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </td>
                  </>
                );
              })()}

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

              {/* Delete row */}
              <td className="px-2 py-2.5 w-8">
                <button
                  onClick={() => deleteSheetProduct(product.id)}
                  className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-accent-red/10 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  title="Delete product"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

      {/* Add Row */}
      <button
        onClick={addSheetProduct}
        className={cn(
          "mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
          "text-text-muted hover:text-text-secondary",
          "border border-dashed border-subtle hover:border-text-muted",
          "transition-all duration-150"
        )}
      >
        <Plus size={14} />
        Add Product
      </button>

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
