"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Upload,
  ImageIcon,
  X,
  Check,
  AlertTriangle,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────

type ProductOption = {
  id: string;
  name: string;
  salePrice: number;
  originalPrice: number;
};

type CreativeCard = {
  id: string;
  concept: string;
};

type LibraryItem = {
  id: string;
  concept: string;
  product: string;
  savedAt: string;
};

// ─── Constants ──────────────────────────────────────────────

const PRODUCTS: ProductOption[] = [
  { id: "p-1", name: "Harrington Trainers", salePrice: 48, originalPrice: 89 },
  {
    id: "p-2",
    name: "Durango Road Sneakers",
    salePrice: 38,
    originalPrice: 72,
  },
  { id: "p-3", name: "Maven Bomber Jacket", salePrice: 65, originalPrice: 120 },
  { id: "p-4", name: "Matteo Cotton Pants", salePrice: 32, originalPrice: 58 },
  {
    id: "p-5",
    name: "Haldrin Layered Shirt",
    salePrice: 42,
    originalPrice: 78,
  },
  { id: "p-6", name: "Enzo Suede Loafers", salePrice: 55, originalPrice: 95 },
  {
    id: "p-7",
    name: "Kensington Wool Overcoat",
    salePrice: 85,
    originalPrice: 165,
  },
];

const BASE_CONCEPTS = [
  "Winter — Text",
  "Winter — No Text",
  "High-End — No Text",
  "High-End — Text",
  "__PRICE__",
  "Replicate Winner",
  "Model Wearing It",
];

// Gradient pairs for placeholder creative cards
const GRADIENTS = [
  "from-indigo-900/60 via-slate-900/80 to-slate-950",
  "from-emerald-900/50 via-slate-900/80 to-slate-950",
  "from-amber-900/40 via-slate-900/80 to-slate-950",
  "from-rose-900/50 via-slate-900/80 to-slate-950",
  "from-violet-900/50 via-slate-900/80 to-slate-950",
  "from-cyan-900/40 via-slate-900/80 to-slate-950",
  "from-fuchsia-900/40 via-slate-900/80 to-slate-950",
];

// ─── Page ───────────────────────────────────────────────────

export default function CreativeGeneratorPage() {
  // ── Form state ──
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [originalPrice, setOriginalPrice] = useState<number | "">("");
  const [conceptCount, setConceptCount] = useState(12);
  const [referenceFile, setReferenceFile] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Generation state ──
  const [generating, setGenerating] = useState(false);
  const [cards, setCards] = useState<CreativeCard[]>([]);

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  // ── Library state ──
  const [library, setLibrary] = useState<LibraryItem[]>([]);

  // ── Derived ──

  const discount = useMemo(() => {
    const sp = typeof salePrice === "number" ? salePrice : 0;
    const op = typeof originalPrice === "number" ? originalPrice : 0;
    if (op <= 0 || sp <= 0 || sp >= op) return 0;
    return Math.round(((op - sp) / op) * 100);
  }, [salePrice, originalPrice]);

  const discountWarning = discount > 50;

  const safeDiscount = discountWarning ? 46 : discount;

  const priceLabel = useMemo(() => {
    const sp = typeof salePrice === "number" ? salePrice : 0;
    const op = typeof originalPrice === "number" ? originalPrice : 0;
    return `Price Shown (£${sp} / was £${op})`;
  }, [salePrice, originalPrice]);

  const conceptLabels = useMemo(
    () =>
      BASE_CONCEPTS.map((c) => (c === "__PRICE__" ? priceLabel : c)),
    [priceLabel]
  );

  const visibleCards = useMemo(
    () => cards.filter((c) => !rejectedIds.has(c.id)),
    [cards, rejectedIds]
  );

  const selectedCount = selectedIds.size;

  const canGenerate =
    productName.trim().length > 0 &&
    typeof salePrice === "number" &&
    salePrice > 0 &&
    typeof originalPrice === "number" &&
    originalPrice > 0 &&
    !generating;

  // ── Handlers ──

  const handleProductSelect = useCallback(
    (id: string) => {
      setSelectedProductId(id);
      const p = PRODUCTS.find((x) => x.id === id);
      if (p) {
        setProductName(p.name);
        setSalePrice(p.salePrice);
        setOriginalPrice(p.originalPrice);
      }
    },
    []
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        setReferenceFile(file.name);
      }
    },
    []
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setReferenceFile(file.name);
      }
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setCards([]);
    setSelectedIds(new Set());
    setRejectedIds(new Set());

    const total = conceptCount;
    const newCards: CreativeCard[] = [];

    for (let i = 0; i < total; i++) {
      const concept = conceptLabels[i % conceptLabels.length];
      const card: CreativeCard = {
        id: `cr-${Date.now()}-${i}`,
        concept,
      };
      newCards.push(card);

      // Stagger: reveal one card at a time with 200ms gap
      await new Promise((r) => setTimeout(r, 200));
      setCards([...newCards]);
    }

    setGenerating(false);
  }, [canGenerate, conceptCount, conceptLabels]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleReject = useCallback((id: string) => {
    setRejectedIds((prev) => new Set(prev).add(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleSaveToLibrary = useCallback(() => {
    const now = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const newItems: LibraryItem[] = cards
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({
        id: c.id,
        concept: c.concept,
        product: productName,
        savedAt: now,
      }));

    setLibrary((prev) => [...newItems, ...prev]);
    // Remove saved cards from gallery
    setCards((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
  }, [cards, selectedIds, productName]);

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="relative">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
          <Sparkles
            className="text-accent-amber"
            size={20}
            strokeWidth={1.8}
          />
        </div>
        <div>
          <h1 className="text-2xl font-syne font-bold tracking-tight">
            Creative Generator
          </h1>
          <p className="text-sm text-text-secondary">
            AI-powered ad creatives via Higgsfield
          </p>
        </div>
      </div>

      {/* ─── Two-panel layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* ━━━━ LEFT — Form Panel ━━━━ */}
        <div className="card p-5 space-y-5 lg:sticky lg:top-6">
          {/* Product selector */}
          <div>
            <label className="block text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
              Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-subtle bg-white/[0.04]",
                "px-3 py-2.5 text-sm text-text-primary",
                "focus:outline-none focus:ring-1 focus:ring-accent-amber/50",
                "appearance-none cursor-pointer"
              )}
            >
              <option value="" className="bg-bg-card text-text-muted">
                Select a product...
              </option>
              {PRODUCTS.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  className="bg-bg-card text-text-primary"
                >
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Upload zone */}
          <div>
            <label className="block text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
              Reference Creative
            </label>
            {referenceFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-subtle bg-white/[0.03] px-3 py-2.5">
                <div className="w-10 h-10 rounded-md bg-accent-amber/10 flex items-center justify-center shrink-0">
                  <ImageIcon
                    size={16}
                    className="text-accent-amber"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">
                    {referenceFile}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    Reference uploaded
                  </p>
                </div>
                <button
                  onClick={() => setReferenceFile(null)}
                  className="text-text-muted hover:text-text-secondary transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative rounded-lg border-2 border-dashed",
                  "flex flex-col items-center justify-center gap-2 py-8 cursor-pointer",
                  "transition-colors duration-150",
                  dragOver
                    ? "border-accent-amber/50 bg-accent-amber/[0.05]"
                    : "border-subtle hover:border-[var(--border-hover)] bg-white/[0.01]"
                )}
              >
                <Upload
                  size={20}
                  strokeWidth={1.5}
                  className={cn(
                    dragOver ? "text-accent-amber" : "text-text-muted"
                  )}
                />
                <p className="text-xs text-text-muted">
                  Drop image or{" "}
                  <span className="text-accent-amber font-medium">
                    browse
                  </span>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Product name */}
          <div>
            <label className="block text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
              Product Name
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Harrington Trainers"
              className={cn(
                "w-full rounded-lg border border-subtle bg-white/[0.04]",
                "px-3 py-2.5 text-sm text-text-primary",
                "focus:outline-none focus:ring-1 focus:ring-accent-amber/50",
                "placeholder:text-text-muted"
              )}
            />
          </div>

          {/* Sale / Original prices side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
                Sale Price (£)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted font-jetbrains">
                  £
                </span>
                <input
                  type="number"
                  value={salePrice}
                  onChange={(e) =>
                    setSalePrice(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  placeholder="0"
                  min={0}
                  className={cn(
                    "w-full rounded-lg border border-subtle bg-white/[0.04]",
                    "pl-7 pr-3 py-2.5 text-sm font-jetbrains text-text-primary",
                    "focus:outline-none focus:ring-1 focus:ring-accent-amber/50",
                    "placeholder:text-text-muted"
                  )}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
                Original Price (£)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted font-jetbrains">
                  £
                </span>
                <input
                  type="number"
                  value={originalPrice}
                  onChange={(e) =>
                    setOriginalPrice(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  placeholder="0"
                  min={0}
                  className={cn(
                    "w-full rounded-lg border border-subtle bg-white/[0.04]",
                    "pl-7 pr-3 py-2.5 text-sm font-jetbrains text-text-primary",
                    "focus:outline-none focus:ring-1 focus:ring-accent-amber/50",
                    "placeholder:text-text-muted"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Discount % */}
          {discount > 0 && (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
                  Discount
                </span>
                <span
                  className={cn(
                    "text-sm font-jetbrains font-semibold tabular-nums",
                    discountWarning
                      ? "text-accent-amber"
                      : "text-accent-emerald"
                  )}
                >
                  {discount}%
                </span>
              </div>
              {discountWarning && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-accent-amber/[0.08] border border-accent-amber/20 px-3 py-2">
                  <AlertTriangle
                    size={14}
                    className="text-accent-amber shrink-0 mt-0.5"
                  />
                  <p className="text-[11px] text-accent-amber leading-relaxed">
                    Facebook may flag discounts over 50% — showing{" "}
                    <span className="font-semibold">{safeDiscount}%</span>{" "}
                    in creative
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Concept slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
                Creatives
              </label>
              <span className="text-sm font-jetbrains text-text-primary tabular-nums">
                {conceptCount}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={20}
              value={conceptCount}
              onChange={(e) => setConceptCount(Number(e.target.value))}
              className="w-full accent-accent-amber h-1.5 rounded-full appearance-none bg-white/[0.06] cursor-pointer"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-text-muted">10</span>
              <span className="text-[10px] text-text-muted">20</span>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={cn(
              "w-full flex items-center justify-center gap-2.5",
              "px-4 py-3.5 rounded-xl text-sm font-semibold",
              "transition-all duration-200",
              canGenerate
                ? "bg-accent-indigo hover:bg-accent-indigo-hover text-white shadow-lg shadow-accent-indigo/25 hover:shadow-accent-indigo/35"
                : "bg-white/[0.04] text-text-muted cursor-not-allowed"
            )}
          >
            <Zap
              size={16}
              fill={canGenerate ? "currentColor" : "none"}
              strokeWidth={canGenerate ? 0 : 1.5}
            />
            {generating ? "Generating..." : "Generate Creatives"}
          </button>
        </div>

        {/* ━━━━ RIGHT — Gallery ━━━━ */}
        <div className="space-y-8">
          {/* Gallery grid */}
          {cards.length > 0 && (
            <div>
              <h3 className="text-sm font-syne font-semibold text-text-primary mb-4">
                Generated Creatives
              </h3>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                <AnimatePresence mode="popLayout">
                  {visibleCards.map((card, idx) => {
                    const isSelected = selectedIds.has(card.id);
                    const gradient =
                      GRADIENTS[idx % GRADIENTS.length];

                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{
                          opacity: 0,
                          scale: 0.85,
                          transition: { duration: 0.2 },
                        }}
                        transition={{
                          duration: 0.35,
                          ease: [0.25, 0.1, 0.25, 1] as const,
                        }}
                        className="group relative"
                      >
                        <div
                          className={cn(
                            "relative rounded-xl overflow-hidden border transition-all duration-200",
                            isSelected
                              ? "border-accent-indigo ring-2 ring-accent-indigo/30"
                              : "border-subtle hover:border-[var(--border-hover)]"
                          )}
                        >
                          {/* Placeholder image */}
                          <div
                            className={cn(
                              "aspect-square bg-gradient-to-br flex items-center justify-center p-4",
                              gradient
                            )}
                          >
                            <span className="text-[13px] font-syne font-semibold text-white/60 text-center leading-snug">
                              {card.concept}
                            </span>
                          </div>

                          {/* Concept label */}
                          <div className="px-3 py-2.5 bg-bg-card">
                            <p className="text-[11px] text-text-secondary truncate font-medium">
                              {card.concept}
                            </p>
                          </div>

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleSelect(card.id)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                                isSelected
                                  ? "bg-accent-indigo text-white"
                                  : "bg-white/10 text-white hover:bg-white/20"
                              )}
                            >
                              <Check size={13} strokeWidth={2.5} />
                              {isSelected ? "Selected" : "Select"}
                            </button>
                            <button
                              onClick={() => handleReject(card.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-accent-red/40 transition-colors"
                            >
                              <X size={13} strokeWidth={2.5} />
                              Reject
                            </button>
                          </div>

                          {/* Selected check mark */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent-indigo flex items-center justify-center">
                              <Check
                                size={12}
                                strokeWidth={3}
                                className="text-white"
                              />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Empty state */}
          {cards.length === 0 && !generating && (
            <div className="rounded-xl border border-dashed border-subtle flex flex-col items-center justify-center min-h-[400px] gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center">
                <ImageIcon
                  size={22}
                  strokeWidth={1.4}
                  className="text-text-muted"
                />
              </div>
              <p className="text-sm text-text-muted">
                Select a product and generate creatives
              </p>
            </div>
          )}

          {/* Creative Library */}
          {library.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Bookmark
                  size={14}
                  strokeWidth={2}
                  className="text-accent-amber"
                />
                <h3 className="text-sm font-syne font-semibold text-text-primary">
                  Creative Library
                </h3>
                <span className="text-[11px] text-text-muted font-jetbrains">
                  ({library.length})
                </span>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {library.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.25, 0.1, 0.25, 1] as const,
                    }}
                    className="rounded-xl overflow-hidden border border-accent-amber/20 bg-accent-amber/[0.02]"
                  >
                    {/* Placeholder */}
                    <div
                      className={cn(
                        "aspect-square bg-gradient-to-br flex items-center justify-center p-4",
                        GRADIENTS[idx % GRADIENTS.length]
                      )}
                    >
                      <span className="text-[13px] font-syne font-semibold text-white/60 text-center leading-snug">
                        {item.concept}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="px-3 py-2.5 bg-bg-card space-y-1">
                      <p className="text-[11px] text-text-secondary truncate font-medium">
                        {item.concept}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-accent-amber font-medium">
                          {item.product}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {item.savedAt}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottom sticky bar ─── */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-40",
              "border-t border-subtle bg-bg-card/95 backdrop-blur-md",
              "px-6 py-4"
            )}
          >
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                <span className="text-text-primary font-semibold font-jetbrains">
                  {selectedCount}
                </span>{" "}
                creative{selectedCount !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={handleSaveToLibrary}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-indigo hover:bg-accent-indigo-hover text-white shadow-lg shadow-accent-indigo/25 transition-all duration-200"
              >
                <Bookmark size={14} />
                Save to Library
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
