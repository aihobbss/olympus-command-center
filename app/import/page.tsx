"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useResearchStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui";
import { ImportQueueCard } from "@/components/modules/ImportQueueCard";

export default function ImportPage() {
  const router = useRouter();
  const { sheetProducts, updateSheetProduct } = useResearchStore();
  const [csvGenerated, setCsvGenerated] = useState(false);

  const queuedProducts = useMemo(
    () => sheetProducts.filter((p) => p.testingStatus === "Queued"),
    [sheetProducts]
  );

  const validProducts = useMemo(
    () => queuedProducts.filter((p) => p.storeLink),
    [queuedProducts]
  );

  const missingLinkCount = queuedProducts.length - validProducts.length;

  function removeFromQueue(id: string) {
    updateSheetProduct(id, { testingStatus: "" });
    setCsvGenerated(false);
  }

  function generateCSV() {
    const header = "Product URL";
    const rows = validProducts.map((p) => p.storeLink);
    const csvContent = [header, ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kopy-import-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCsvGenerated(true);
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
          <Package
            className="text-accent-indigo"
            size={20}
            strokeWidth={1.8}
          />
        </div>
        <div>
          <h1 className="text-2xl font-syne font-bold tracking-tight">
            Import
          </h1>
          <p className="text-sm text-text-secondary">
            Bridge products into your store via Kopy
          </p>
        </div>
      </div>

      {/* ── Empty state ── */}
      {queuedProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products in queue"
          description="Mark products as Import on the Research Sheet to add them here"
          action={{
            label: "Go to Research Sheet",
            onClick: () => router.push("/research"),
          }}
        />
      ) : (
        <>
          {/* ── Summary bar ── */}
          <div className="card p-4 mb-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-jetbrains font-bold text-text-primary">
                {queuedProducts.length}
              </span>
              <span className="text-sm text-text-secondary">
                product{queuedProducts.length !== 1 ? "s" : ""} queued
              </span>
            </div>

            {missingLinkCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-amber)]">
                <AlertTriangle size={13} />
                {missingLinkCount} will be skipped &mdash; no store link
              </span>
            )}

            <button
              onClick={generateCSV}
              disabled={validProducts.length === 0}
              className={cn(
                "ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                "transition-colors duration-150",
                validProducts.length > 0
                  ? "bg-accent-indigo text-white hover:bg-accent-indigo/80"
                  : "bg-white/[0.04] text-text-muted cursor-not-allowed"
              )}
            >
              <Download size={15} />
              Generate CSV
            </button>
          </div>

          {/* ── Success banner ── */}
          <AnimatePresence>
            {csvGenerated && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="card p-4 mb-4 border-l-2 border-l-[var(--accent-emerald)] flex items-start gap-3">
                  <CheckCircle
                    size={18}
                    className="text-[var(--accent-emerald)] shrink-0 mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      CSV downloaded
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Now upload that CSV to the{" "}
                      <span className="text-text-primary font-medium">
                        Multiple Product Links
                      </span>{" "}
                      section in Kopy
                    </p>
                  </div>
                  <button
                    onClick={() => setCsvGenerated(false)}
                    className="text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Queue list ── */}
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {queuedProducts.map((product, i) => (
                <ImportQueueCard
                  key={product.id}
                  product={product}
                  index={i}
                  onRemove={removeFromQueue}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
