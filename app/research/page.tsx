"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ExternalLink,
  ArrowRight,
  X,
  Loader2,
  Check,
  Play,
} from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { useProductStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

type Source = "afterlib" | "winning-hunter";

type ScanStep = {
  text: string;
  duration: number;
};

// ─── Constants ───────────────────────────────────────────

const SCAN_STEPS: ScanStep[] = [
  { text: "Connecting to {source}...", duration: 800 },
  { text: "Scanning active ads...", duration: 1200 },
  { text: "Filtering by criteria...", duration: 1000 },
  { text: "Found 12 candidates", duration: 600 },
];

const STATUS_VARIANT = {
  Queued: "neutral",
  Testing: "warning",
  Killed: "danger",
  Imported: "success",
} as const;

const SOURCE_LABEL: Record<Source, string> = {
  afterlib: "Afterlib",
  "winning-hunter": "Winning Hunter",
};

// ─── Animation variants ──────────────────────────────────

const tableContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.055 },
  },
};

const tableRow = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

// ─── Page ────────────────────────────────────────────────

export default function ResearchPage() {
  const { products, setProductStatus } = useProductStore();

  const [source, setSource] = useState<Source>("afterlib");
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(-1);
  const [showTable, setShowTable] = useState(true);
  const [tableKey, setTableKey] = useState(0);
  const scanLock = useRef(false);

  // ── Derived counts ──

  const counts = useMemo(() => {
    const c = { total: 0, queued: 0, testing: 0, imported: 0, killed: 0 };
    for (const p of products) {
      c.total++;
      if (p.status === "Queued") c.queued++;
      else if (p.status === "Testing") c.testing++;
      else if (p.status === "Imported") c.imported++;
      else if (p.status === "Killed") c.killed++;
    }
    return c;
  }, [products]);

  // ── Scan simulation ──

  const runScan = useCallback(async () => {
    if (scanLock.current) return;
    scanLock.current = true;

    setScanning(true);
    setShowTable(false);
    setScanStep(0);

    for (let i = 0; i < SCAN_STEPS.length; i++) {
      setScanStep(i);
      await new Promise((r) => setTimeout(r, SCAN_STEPS[i].duration));
    }

    setScanStep(SCAN_STEPS.length);
    await new Promise((r) => setTimeout(r, 350));

    setScanning(false);
    setTableKey((k) => k + 1);
    setShowTable(true);

    setTimeout(() => {
      scanLock.current = false;
    }, 600);
  }, []);

  // ── Row actions ──

  const handleImport = useCallback(
    (id: string) => setProductStatus(id, "Queued"),
    [setProductStatus]
  );

  const handleKill = useCallback(
    (id: string) => setProductStatus(id, "Killed"),
    [setProductStatus]
  );

  // ── Resolved scan step text ──

  const resolvedSteps = useMemo(
    () =>
      SCAN_STEPS.map((s) => ({
        ...s,
        text: s.text.replace("{source}", SOURCE_LABEL[source]),
      })),
    [source]
  );

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
            <Search
              className="text-accent-indigo"
              size={20}
              strokeWidth={1.8}
            />
          </div>
          <div>
            <h1 className="text-2xl font-syne font-bold tracking-tight">
              Research
            </h1>
            <p className="text-sm text-text-secondary">
              Discover winning products from competitor ads
            </p>
          </div>
        </div>
      </div>

      {/* ─── Controls bar ─── */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        {/* Source toggle */}
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-1 border border-subtle">
          {(["afterlib", "winning-hunter"] as Source[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "relative px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors duration-150",
                source === s
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {source === s && (
                <motion.div
                  layoutId="source-pill"
                  className="absolute inset-0 rounded-md bg-accent-indigo/15 ring-1 ring-accent-indigo/25"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10">{SOURCE_LABEL[s]}</span>
            </button>
          ))}
        </div>

        {/* Run Research button */}
        <button
          onClick={runScan}
          disabled={scanning}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            scanning
              ? "bg-accent-indigo/20 text-accent-indigo cursor-not-allowed"
              : "bg-accent-indigo hover:bg-accent-indigo-hover text-white shadow-lg shadow-accent-indigo/20 hover:shadow-accent-indigo/30"
          )}
        >
          {scanning ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" />
              Run Research
            </>
          )}
        </button>
      </div>

      {/* ─── Scan progress ─── */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden mb-6"
          >
            <div className="card p-4 border-l-2 border-l-accent-indigo">
              <div className="space-y-3">
                {resolvedSteps.map((step, i) => {
                  const done = i < scanStep;
                  const active = i === scanStep;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.25 }}
                      className="flex items-center gap-3"
                    >
                      {/* Indicator */}
                      {done ? (
                        <div className="w-5 h-5 rounded-full bg-accent-emerald/15 flex items-center justify-center shrink-0">
                          <Check
                            size={11}
                            strokeWidth={2.5}
                            className="text-accent-emerald"
                          />
                        </div>
                      ) : active ? (
                        <div className="w-5 h-5 rounded-full bg-accent-indigo/15 flex items-center justify-center shrink-0">
                          <Loader2
                            size={11}
                            strokeWidth={2.5}
                            className="text-accent-indigo animate-spin"
                          />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                        </div>
                      )}

                      {/* Text */}
                      <span
                        className={cn(
                          "text-[13px] font-mono-metric",
                          done
                            ? "text-text-secondary"
                            : active
                              ? "text-text-primary"
                              : "text-text-muted"
                        )}
                      >
                        {step.text}
                      </span>

                      {/* Duration badge (completed only) */}
                      {done && (
                        <span className="text-[10px] text-text-muted font-jetbrains ml-auto tabular-nums">
                          {(step.duration / 1000).toFixed(1)}s
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Result counts ─── */}
      {showTable && (
        <div className="flex items-center gap-3 mb-3 text-[11px] font-jetbrains tracking-wide">
          <span className="text-text-secondary">
            <span className="text-text-primary font-semibold">
              {counts.total}
            </span>{" "}
            products
          </span>
          <span className="text-text-muted">&middot;</span>
          <span className="text-text-muted">
            {counts.queued} queued
          </span>
          <span className="text-text-muted">&middot;</span>
          <span className="text-accent-amber/80">
            {counts.testing} testing
          </span>
          <span className="text-text-muted">&middot;</span>
          <span className="text-accent-emerald/80">
            {counts.imported} imported
          </span>
          <span className="text-text-muted">&middot;</span>
          <span className="text-accent-red/80">
            {counts.killed} killed
          </span>
        </div>
      )}

      {/* ─── Data table ─── */}
      <AnimatePresence mode="wait">
        {showTable && (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="overflow-x-auto rounded-xl border border-subtle bg-bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-subtle">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-left">
                      Product Name
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-left hidden lg:table-cell">
                      Competitor
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-center">
                      Ad
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">
                      Brands
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">
                      Days
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right hidden sm:table-cell">
                      Creatives
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-center">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <motion.tbody
                  key={tableKey}
                  variants={tableContainer}
                  initial={tableKey > 0 ? "hidden" : false}
                  animate="visible"
                >
                  {products.map((product) => {
                    const killed = product.status === "Killed";
                    const imported = product.status === "Imported";
                    const canImport = product.status === "Testing";
                    const canKill =
                      product.status === "Testing" ||
                      product.status === "Queued";

                    return (
                      <motion.tr
                        key={product.id}
                        variants={tableRow}
                        className={cn(
                          "border-b border-subtle last:border-b-0 transition-colors duration-100",
                          killed && "opacity-35"
                        )}
                      >
                        {/* Product Name */}
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "font-medium text-text-primary",
                              killed &&
                                "line-through decoration-accent-red/50"
                            )}
                          >
                            {product.productName}
                          </span>
                        </td>

                        {/* Competitor */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <a
                            href={product.storeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-secondary hover:text-text-primary text-xs font-mono-metric truncate max-w-[160px] inline-block transition-colors"
                          >
                            {product.storeLink
                              .replace("https://", "")
                              .replace(".myshopify.com", "")}
                          </a>
                        </td>

                        {/* Ad Link */}
                        <td className="px-4 py-3 text-center">
                          <a
                            href={product.adLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                              "bg-accent-indigo/10 text-accent-indigo hover:bg-accent-indigo/20"
                            )}
                          >
                            <ExternalLink size={11} />
                            Ad
                          </a>
                        </td>

                        {/* Brands Running */}
                        <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                          {product.brandsRunning}
                        </td>

                        {/* Days Active */}
                        <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums">
                          {product.daysActive}
                        </td>

                        {/* Creatives Count */}
                        <td className="px-4 py-3 text-right font-jetbrains text-text-primary tabular-nums hidden sm:table-cell">
                          {product.creativesCount}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <StatusBadge
                            status={product.status}
                            variant={STATUS_VARIANT[product.status]}
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {canImport && (
                              <button
                                onClick={() => handleImport(product.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-accent-indigo/10 text-accent-indigo hover:bg-accent-indigo/20 transition-colors"
                              >
                                Import
                                <ArrowRight size={11} />
                              </button>
                            )}
                            {canKill && (
                              <button
                                onClick={() => handleKill(product.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors"
                              >
                                <X size={11} />
                                Kill
                              </button>
                            )}
                            {imported && (
                              <span className="text-[11px] text-accent-emerald font-medium">
                                Imported
                              </span>
                            )}
                            {killed && (
                              <span className="text-[11px] text-accent-red/60 font-medium">
                                Killed
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
