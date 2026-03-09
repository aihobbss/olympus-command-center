"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Zap,
  Minus,
  Plus,
  X,
  ImageIcon,
  Loader2,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreativeGeneratorStore } from "@/lib/store";
import { PROMPT_TEMPLATES } from "@/data/mock";


export function CreativeBatchQueue() {
  const {
    batchQueue,
    productCreatives,
    imagesPerProduct,
    promptAllocations,
    setImagesPerProduct,
    setPromptAllocations,
    generateBatch,
    removeCreative,
  } = useCreativeGeneratorStore();

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set()
  );

  // ── Derived ──

  const generatingProducts = useMemo(
    () => batchQueue.filter((p) => p.status === "generating"),
    [batchQueue]
  );

  const isGenerating = generatingProducts.length > 0;

  const totalAllocated = useMemo(
    () => promptAllocations.reduce((sum, a) => sum + a.count, 0),
    [promptAllocations]
  );

  const selectedCount = selectedProductIds.size;

  // Group creatives by product
  const creativesByProduct = useMemo(() => {
    const map = new Map<string, typeof productCreatives>();
    for (const c of productCreatives) {
      if (!map.has(c.productName)) map.set(c.productName, []);
      map.get(c.productName)!.push(c);
    }
    return map;
  }, [productCreatives]);

  // ── Handlers ──

  const toggleProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const queued = batchQueue.filter((p) => p.status === "queued");
    setSelectedProductIds(new Set(queued.map((p) => p.id)));
  }, [batchQueue]);

  const togglePrompt = useCallback(
    (templateId: string, label: string) => {
      const existing = promptAllocations.find(
        (a) => a.templateId === templateId
      );
      if (existing) {
        const remaining = promptAllocations.filter(
          (a) => a.templateId !== templateId
        );
        // Redistribute removed count to first remaining prompt
        if (remaining.length > 0) {
          remaining[0] = {
            ...remaining[0],
            count: remaining[0].count + existing.count,
          };
        }
        setPromptAllocations(remaining);
      } else {
        // Auto-distribute: take 1 from the prompt with most, give to new
        const updated = [...promptAllocations];
        if (updated.length > 0) {
          const maxIdx = updated.reduce(
            (mi, a, i) => (a.count > updated[mi].count ? i : mi),
            0
          );
          if (updated[maxIdx].count > 1) {
            updated[maxIdx] = {
              ...updated[maxIdx],
              count: updated[maxIdx].count - 1,
            };
            setPromptAllocations([
              ...updated,
              { templateId, label, count: 1 },
            ]);
          } else {
            setPromptAllocations([
              ...updated,
              { templateId, label, count: 1 },
            ]);
            // Total will exceed — adjust images per product
            setImagesPerProduct(imagesPerProduct + 1);
          }
        } else {
          setPromptAllocations([
            { templateId, label, count: imagesPerProduct },
          ]);
        }
      }
    },
    [promptAllocations, setPromptAllocations, imagesPerProduct, setImagesPerProduct]
  );

  const adjustPromptCount = useCallback(
    (templateId: string, delta: number) => {
      setPromptAllocations(
        promptAllocations.map((a) =>
          a.templateId === templateId
            ? { ...a, count: Math.max(1, Math.min(10, a.count + delta)) }
            : a
        )
      );
    },
    [promptAllocations, setPromptAllocations]
  );

  const handleGenerate = useCallback(() => {
    if (selectedCount === 0 || promptAllocations.length === 0) return;
    generateBatch(Array.from(selectedProductIds));
    setSelectedProductIds(new Set());
  }, [selectedCount, promptAllocations, selectedProductIds, generateBatch]);

  // ── Empty state ──

  if (batchQueue.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-subtle flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center">
          <Package size={22} strokeWidth={1.4} className="text-text-muted" />
        </div>
        <p className="text-sm text-text-muted">No products in the queue yet</p>
        <p className="text-xs text-text-muted max-w-xs text-center">
          Push products to store from Product Creation — they&apos;ll appear here
          automatically
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top: Product selection + Config ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Product list */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-syne font-semibold text-text-primary">
              Batch Queue{" "}
              <span className="text-text-muted font-jetbrains font-normal">
                ({batchQueue.length})
              </span>
            </h3>
            <button
              onClick={selectAll}
              className="text-[11px] text-accent-indigo hover:text-accent-indigo/80 font-medium transition-colors"
            >
              Select All
            </button>
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {batchQueue.map((product) => {
              const isSelected = selectedProductIds.has(product.id);
              const isCompleted = product.status === "completed";
              const isGen = product.status === "generating";

              return (
                <div
                  key={product.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150",
                    isSelected
                      ? "bg-accent-indigo/[0.06] border border-accent-indigo/20"
                      : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleProduct(product.id)}
                    disabled={isGen}
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors duration-150",
                      isGen
                        ? "border-subtle text-transparent cursor-not-allowed"
                        : isSelected
                          ? "bg-accent-indigo/20 border-accent-indigo/50 text-accent-indigo"
                          : "border-subtle text-transparent hover:border-text-muted"
                    )}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>

                  {/* Product name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {product.productName}
                    </p>
                  </div>

                  {/* Status */}
                  {isGen && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-violet-400">
                      <Loader2 size={12} className="animate-spin" />
                      Generating
                    </span>
                  )}
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-emerald)]">
                      <Check size={12} />
                      Done
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuration */}
        <div className="card p-5 space-y-5">
          {/* Images per product */}
          <div>
            <label className="block text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
              Images per product
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setImagesPerProduct(Math.max(1, imagesPerProduct - 1))
                }
                className="w-8 h-8 rounded-lg border border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="text-lg font-jetbrains font-semibold text-text-primary w-8 text-center tabular-nums">
                {imagesPerProduct}
              </span>
              <button
                onClick={() =>
                  setImagesPerProduct(Math.min(10, imagesPerProduct + 1))
                }
                className="w-8 h-8 rounded-lg border border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Prompt templates */}
          <div>
            <label className="block text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
              Prompt Templates
            </label>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {PROMPT_TEMPLATES.map((t) => {
                const alloc = promptAllocations.find(
                  (a) => a.templateId === t.id
                );
                const isActive = Boolean(alloc);

                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-150",
                      isActive
                        ? "bg-accent-amber/[0.06] border border-accent-amber/20"
                        : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
                    )}
                  >
                    <button
                      onClick={() => togglePrompt(t.id, t.label)}
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors duration-150",
                        isActive
                          ? "bg-accent-amber/20 border-accent-amber/50 text-accent-amber"
                          : "border-subtle text-transparent hover:border-text-muted"
                      )}
                    >
                      <Check size={10} strokeWidth={3} />
                    </button>

                    <span className="flex-1 text-[11px] font-medium text-text-primary truncate">
                      {t.label}
                    </span>

                    {isActive && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => adjustPromptCount(t.id, -1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-[11px] font-jetbrains text-text-primary w-3 text-center tabular-nums">
                          {alloc!.count}
                        </span>
                        <button
                          onClick={() => adjustPromptCount(t.id, 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-subtle pt-4">
            <p className="text-[11px] text-text-muted mb-3">
              {selectedCount > 0 ? (
                <>
                  <span className="text-text-primary font-medium">
                    {selectedCount}
                  </span>{" "}
                  product{selectedCount !== 1 ? "s" : ""} ×{" "}
                  <span className="text-text-primary font-medium">
                    {totalAllocated}
                  </span>{" "}
                  ={" "}
                  <span className="text-accent-amber font-semibold font-jetbrains">
                    {selectedCount * totalAllocated}
                  </span>{" "}
                  creatives
                </>
              ) : (
                "Select products and prompts to generate"
              )}
            </p>

            <button
              onClick={handleGenerate}
              disabled={
                selectedCount === 0 ||
                promptAllocations.length === 0 ||
                isGenerating
              }
              className={cn(
                "w-full flex items-center justify-center gap-2.5",
                "px-4 py-3 rounded-xl text-sm font-semibold",
                "transition-all duration-200",
                selectedCount > 0 && promptAllocations.length > 0 && !isGenerating
                  ? "bg-accent-indigo hover:bg-accent-indigo-hover text-white shadow-lg shadow-accent-indigo/25"
                  : "bg-white/[0.04] text-text-muted cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap
                    size={16}
                    fill={selectedCount > 0 ? "currentColor" : "none"}
                    strokeWidth={selectedCount > 0 ? 0 : 1.5}
                  />
                  Generate All
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Generated Creatives grouped by product ── */}
      {productCreatives.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-sm font-syne font-semibold text-text-primary">
            Generated Creatives
          </h3>

          {Array.from(creativesByProduct.entries()).map(
            ([productName, creatives]) => (
              <div key={productName} className="card p-4">
                <h4 className="text-xs font-medium text-text-secondary mb-3">
                  {productName}{" "}
                  <span className="text-text-muted font-jetbrains">
                    ({creatives.length})
                  </span>
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  <AnimatePresence mode="popLayout">
                    {creatives.map((creative) => (
                      <motion.div
                        key={creative.id}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const }}
                        className="group relative"
                      >
                        <div
                          className={cn(
                            "relative rounded-xl overflow-hidden border transition-all duration-200",
                            creative.status === "completed"
                              ? "border-subtle hover:border-[var(--border-hover)]"
                              : "border-subtle/50"
                          )}
                        >
                          {/* Placeholder image */}
                          <div
                            className={cn(
                              "aspect-square bg-gradient-to-br flex items-center justify-center p-3",
                              creative.placeholderGradient
                            )}
                          >
                            {creative.status === "pending" ? (
                              <Loader2
                                size={18}
                                className="text-white/40 animate-spin"
                              />
                            ) : (
                              <span className="text-[10px] font-syne font-semibold text-white/60 text-center leading-snug">
                                {creative.concept}
                              </span>
                            )}
                          </div>

                          {/* Label */}
                          <div className="px-2 py-1.5 bg-bg-card">
                            <p className="text-[10px] text-text-secondary truncate">
                              {creative.concept}
                            </p>
                          </div>

                          {/* Delete on hover */}
                          {creative.status === "completed" && (
                            <button
                              onClick={() => removeCreative(creative.id)}
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-white hover:bg-accent-red/80 opacity-0 group-hover:opacity-100 transition-all duration-150"
                            >
                              <X size={10} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Empty generated state */}
      {productCreatives.length === 0 && (
        <div className="rounded-xl border border-dashed border-subtle flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center">
            <ImageIcon size={18} strokeWidth={1.4} className="text-text-muted" />
          </div>
          <p className="text-xs text-text-muted">
            Select products and generate to see creatives here
          </p>
        </div>
      )}
    </div>
  );
}
