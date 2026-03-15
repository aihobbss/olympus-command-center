"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
  SlidersHorizontal,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStoreContext, useCreativeGeneratorStore, useProductCopyStore, useAuthStore, useConnectionsStore } from "@/lib/store";
import { ActionSlider } from "@/components/ui";
import { PROMPT_TEMPLATES as SHARED_PROMPT_TEMPLATES } from "@/data/mock";
import { CreativeBatchQueue } from "@/components/modules/CreativeBatchQueue";
import { ServiceConnectionOverlay } from "@/components/modules/ServiceConnectionCard";
import { SERVICE_REGISTRY } from "@/lib/services/connections";
import { createCreative, fetchSavedCreatives, updateCreativeStatus } from "@/lib/services/creative-generator";

// ─── Types ──────────────────────────────────────────────────

type ProductOption = {
  id: string;
  name: string;
  imageUrl: string;
};

type CreativeCard = {
  id: string;
  concept: string;
  dbId?: string; // Supabase creative ID when persisted
};

type ActivePrompt = {
  templateId: string | null;
  label: string;
  prompt: string;
  count: number;
};

type LibraryItem = {
  id: string;
  concept: string;
  product: string;
  savedAt: string;
};

// ─── Constants ──────────────────────────────────────────────

const PROMPT_TEMPLATES = SHARED_PROMPT_TEMPLATES;

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

type CreativeTab = "single" | "batch";

export default function CreativeGeneratorPage() {
  const { selectedStore } = useStoreContext();
  const user = useAuthStore((s) => s.user);
  const { loadConnections, isConnected } = useConnectionsStore();
  const { loadBatchQueue } = useCreativeGeneratorStore();
  const copyProducts = useProductCopyStore((s) => s.copyProducts);
  const loadCopyProducts = useProductCopyStore((s) => s.loadProducts);

  useEffect(() => {
    if (user) loadConnections();
  }, [user, loadConnections]);

  // Load product copies from Supabase to populate the product selector
  useEffect(() => {
    if (selectedStore) {
      loadCopyProducts(selectedStore.id);
      loadBatchQueue(selectedStore.id);
    }
  }, [selectedStore, loadCopyProducts, loadBatchQueue]);

  // Build product options from Supabase product_copies (pushed products preferred)
  const products: ProductOption[] = useMemo(() => {
    return copyProducts
      .filter((p) => p.productName)
      .map((p) => ({
        id: p.id,
        name: p.productName,
        imageUrl: p.imageUrl,
      }));
  }, [copyProducts]);

  // Load saved creatives from Supabase as library items
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryLoadedForStore, setLibraryLoadedForStore] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedStore || libraryLoadedForStore === selectedStore.id) return;
    (async () => {
      const saved = await fetchSavedCreatives(selectedStore.id);
      setLibrary(
        saved.map((c) => ({
          id: c.id,
          concept: c.concept,
          product: c.productName,
          savedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        }))
      );
      setLibraryLoadedForStore(selectedStore.id);
    })();
  }, [selectedStore, libraryLoadedForStore]);

  const nanobananaConnected = isConnected("nanobanana");
  const nanobananaMeta = SERVICE_REGISTRY.find((s) => s.id === "nanobanana")!;

  const [activeTab, setActiveTab] = useState<CreativeTab>("single");
  const batchQueueCount = useCreativeGeneratorStore((s) => s.batchQueue.length);

  // ── Form state ──
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [originalPrice, setOriginalPrice] = useState<number | "">("");
  const [referenceFile, setReferenceFile] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Prompt configuration ──
  const [activePrompts, setActivePrompts] = useState<ActivePrompt[]>([]);
  const [promptPanelOpen, setPromptPanelOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  // ── Generation state ──
  const [generating, setGenerating] = useState(false);
  const [cards, setCards] = useState<CreativeCard[]>([]);

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  // ── Derived ──

  const discount = useMemo(() => {
    const sp = typeof salePrice === "number" ? salePrice : 0;
    const op = typeof originalPrice === "number" ? originalPrice : 0;
    if (op <= 0 || sp <= 0 || sp >= op) return 0;
    return Math.round(((op - sp) / op) * 100);
  }, [salePrice, originalPrice]);

  const discountWarning = discount > 50;

  const safeDiscount = discountWarning ? 46 : discount;

  const totalCreatives = useMemo(
    () => activePrompts.reduce((sum, p) => sum + p.count, 0),
    [activePrompts]
  );

  const visibleCards = useMemo(
    () => cards.filter((c) => !rejectedIds.has(c.id)),
    [cards, rejectedIds]
  );

  const selectedCount = selectedIds.size;

  const canGenerate =
    productName.trim().length > 0 &&
    activePrompts.length > 0 &&
    !generating;

  // ── Handlers ──

  const handleProductSelect = useCallback(
    (id: string) => {
      setSelectedProductId(id);
      const p = products.find((x) => x.id === id);
      if (p) {
        setProductName(p.name);
      }
    },
    [products]
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
    if (!canGenerate || !selectedStore) return;
    setGenerating(true);
    setCards([]);
    setSelectedIds(new Set());
    setRejectedIds(new Set());

    const newCards: CreativeCard[] = [];
    let idx = 0;

    for (const ap of activePrompts) {
      for (let i = 0; i < ap.count; i++) {
        // Persist creative to Supabase
        const dbCreative = await createCreative(selectedStore.id, {
          productName,
          promptTemplate: ap.label,
          prompt: ap.prompt,
        });

        const card: CreativeCard = {
          id: `cr-${Date.now()}-${idx}`,
          concept: ap.label,
          dbId: dbCreative?.id || undefined,
        };
        newCards.push(card);
        idx++;

        // Stagger: reveal one card at a time with 200ms gap
        await new Promise((r) => setTimeout(r, 200));
        setCards([...newCards]);

        // Mark as ready immediately (placeholder until Nanobanana generates real images)
        if (dbCreative?.id) {
          await updateCreativeStatus(dbCreative.id, "ready");
        }
      }
    }

    setGenerating(false);
  }, [canGenerate, activePrompts, selectedStore, productName]);

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

  const handleSaveToLibrary = useCallback(async () => {
    const now = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const selectedCards = cards.filter((c) => selectedIds.has(c.id));

    // Persist "saved" status to Supabase for each selected creative
    for (const card of selectedCards) {
      if (card.dbId) {
        await updateCreativeStatus(card.dbId, "saved");
      }
    }

    const newItems: LibraryItem[] = selectedCards.map((c) => ({
      id: c.dbId || c.id,
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

  if (!selectedStore) return null;
  const currency = selectedStore.currency;

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
            {activeTab === "single"
              ? "AI-powered ad creatives via Nanobanana Pro"
              : "Bulk generate creatives for pushed products"}
          </p>
        </div>
      </div>

      {/* ─── Connection gate ─── */}
      {!nanobananaConnected ? (
        <ServiceConnectionOverlay
          moduleName="Creative Generator"
          services={[
            {
              service: "nanobanana",
              description: nanobananaMeta.description,
              onConnect: () => { window.location.href = "/settings?connect=nanobanana"; },
            },
          ]}
        />
      ) : (<>

      {/* ─── Tab Switcher ─── */}
      <div className="flex gap-1 p-1 rounded-xl bg-bg-elevated/60 w-fit mb-6">
        <button
          onClick={() => setActiveTab("single")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "single"
              ? "bg-accent-amber text-black shadow-lg shadow-accent-amber/20"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          Single Product
        </button>
        <button
          onClick={() => setActiveTab("batch")}
          className={cn(
            "relative px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "batch"
              ? "bg-accent-amber text-black shadow-lg shadow-accent-amber/20"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          Batch Queue
          {batchQueueCount > 0 && activeTab !== "batch" && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-indigo text-white text-[9px] font-bold flex items-center justify-center">
              {batchQueueCount}
            </span>
          )}
        </button>
      </div>

      {/* ─── Batch Queue Tab ─── */}
      {activeTab === "batch" && <CreativeBatchQueue />}

      {/* ─── Single Product Tab ─── */}
      {activeTab === "single" && (<>
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
                {products.length === 0 ? "No products yet — add in Product Creation" : "Select a product..."}
              </option>
              {products.map((p) => (
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
                Sale Price ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted font-jetbrains">
                  {currency}
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
                Original Price ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted font-jetbrains">
                  {currency}
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

          {/* Configure prompts button */}
          <div>
            <label className="block text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
              Prompts
            </label>
            <button
              onClick={() => setPromptPanelOpen(true)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors duration-150",
                activePrompts.length > 0
                  ? "border-accent-amber/30 bg-accent-amber/[0.05] hover:bg-accent-amber/[0.08]"
                  : "border-subtle bg-white/[0.03] hover:border-[var(--border-hover)]"
              )}
            >
              <SlidersHorizontal size={15} className="text-accent-amber shrink-0" />
              <div className="flex-1 text-left">
                {activePrompts.length > 0 ? (
                  <>
                    <p className="text-xs font-medium text-text-primary">
                      {activePrompts.length} prompt{activePrompts.length !== 1 ? "s" : ""} configured
                    </p>
                    <p className="text-[10px] text-text-muted font-jetbrains">
                      {totalCreatives} creative{totalCreatives !== 1 ? "s" : ""} total
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-text-muted">Configure prompts...</p>
                )}
              </div>
            </button>
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

      </>)}

      {/* ─── Configure Prompts Panel ─── */}
      <ActionSlider
        open={promptPanelOpen}
        onClose={() => setPromptPanelOpen(false)}
        title="Configure Prompts"
        width="460px"
      >
        <div className="space-y-6">
          {/* Template list */}
          <div>
            <h4 className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-3">
              Templates
            </h4>
            <div className="space-y-1.5">
              {PROMPT_TEMPLATES.map((t) => {
                const active = activePrompts.find((ap) => ap.templateId === t.id);
                const isActive = Boolean(active);

                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150",
                      isActive
                        ? "bg-accent-amber/[0.06] border border-accent-amber/20"
                        : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => {
                        if (isActive) {
                          setActivePrompts((prev) =>
                            prev.filter((ap) => ap.templateId !== t.id)
                          );
                        } else {
                          setActivePrompts((prev) => [
                            ...prev,
                            { templateId: t.id, label: t.label, prompt: t.prompt, count: 2 },
                          ]);
                        }
                      }}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors duration-150",
                        isActive
                          ? "bg-accent-amber/20 border-accent-amber/50 text-accent-amber"
                          : "border-subtle text-transparent hover:border-text-muted"
                      )}
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>

                    {/* Label + prompt preview */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">
                        {t.label}
                      </p>
                      <p className="text-[10px] text-text-muted truncate">
                        {t.prompt}
                      </p>
                    </div>

                    {/* Count stepper */}
                    {isActive && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            setActivePrompts((prev) =>
                              prev.map((ap) =>
                                ap.templateId === t.id
                                  ? { ...ap, count: Math.max(1, ap.count - 1) }
                                  : ap
                              )
                            )
                          }
                          className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-jetbrains text-text-primary w-4 text-center tabular-nums">
                          {active!.count}
                        </span>
                        <button
                          onClick={() =>
                            setActivePrompts((prev) =>
                              prev.map((ap) =>
                                ap.templateId === t.id
                                  ? { ...ap, count: Math.min(10, ap.count + 1) }
                                  : ap
                              )
                            )
                          }
                          className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom prompts already added */}
          {activePrompts.filter((ap) => ap.templateId === null).length > 0 && (
            <div>
              <h4 className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-3">
                Custom Prompts
              </h4>
              <div className="space-y-1.5">
                {activePrompts
                  .filter((ap) => ap.templateId === null)
                  .map((ap, i) => (
                    <div
                      key={`custom-${i}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-accent-indigo/[0.06] border border-accent-indigo/20"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">
                          {ap.label}
                        </p>
                        <p className="text-[10px] text-text-muted truncate">
                          {ap.prompt}
                        </p>
                      </div>

                      {/* Count stepper */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            setActivePrompts((prev) =>
                              prev.map((p) =>
                                p === ap
                                  ? { ...p, count: Math.max(1, p.count - 1) }
                                  : p
                              )
                            )
                          }
                          className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-jetbrains text-text-primary w-4 text-center tabular-nums">
                          {ap.count}
                        </span>
                        <button
                          onClick={() =>
                            setActivePrompts((prev) =>
                              prev.map((p) =>
                                p === ap
                                  ? { ...p, count: Math.min(10, p.count + 1) }
                                  : p
                              )
                            )
                          }
                          className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() =>
                          setActivePrompts((prev) => prev.filter((p) => p !== ap))
                        }
                        className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Add custom prompt */}
          <div>
            <h4 className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-3">
              Add Custom Prompt
            </h4>
            <div className="space-y-2">
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Label (e.g. Streetwear Vibe)"
                className={cn(
                  "w-full rounded-lg border border-subtle bg-white/[0.04]",
                  "px-3 py-2 text-xs text-text-primary",
                  "focus:outline-none focus:ring-1 focus:ring-accent-indigo/50",
                  "placeholder:text-text-muted"
                )}
              />
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Prompt description..."
                rows={2}
                className={cn(
                  "w-full rounded-lg border border-subtle bg-white/[0.04]",
                  "px-3 py-2 text-xs text-text-primary resize-none",
                  "focus:outline-none focus:ring-1 focus:ring-accent-indigo/50",
                  "placeholder:text-text-muted"
                )}
              />
              <button
                onClick={() => {
                  if (!customLabel.trim()) return;
                  setActivePrompts((prev) => [
                    ...prev,
                    {
                      templateId: null,
                      label: customLabel.trim(),
                      prompt: customPrompt.trim() || customLabel.trim(),
                      count: 2,
                    },
                  ]);
                  setCustomLabel("");
                  setCustomPrompt("");
                }}
                disabled={!customLabel.trim()}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150",
                  customLabel.trim()
                    ? "bg-accent-indigo/15 text-accent-indigo hover:bg-accent-indigo/25"
                    : "bg-white/[0.04] text-text-muted cursor-not-allowed"
                )}
              >
                <Plus size={12} />
                Add Prompt
              </button>
            </div>
          </div>

          {/* Summary + Done */}
          <div className="border-t border-subtle pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {activePrompts.length} prompt{activePrompts.length !== 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-text-muted font-jetbrains">
                  {totalCreatives} creative{totalCreatives !== 1 ? "s" : ""} total
                </p>
              </div>
              <button
                onClick={() => setPromptPanelOpen(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-amber text-black hover:bg-accent-amber/90 transition-colors duration-150"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </ActionSlider>

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

      </>)}
    </div>
  );
}
