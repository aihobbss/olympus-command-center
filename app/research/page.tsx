"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Check,
  Play,
  ClipboardList,
  Compass,
} from "lucide-react";
import { useResearchStore } from "@/lib/store";
import { ResearchCard } from "@/components/modules/ResearchCard";
import { ResearchSheet } from "@/components/modules/ResearchSheet";
import { cn } from "@/lib/utils";

// ─── Types & constants ──────────────────────────────────

type Tab = "discover" | "sheet";
type Source = "afterlib" | "winning-hunter";

type ScanStep = { text: string; duration: number };

const SOURCE_LABEL: Record<Source, string> = {
  afterlib: "Afterlib",
  "winning-hunter": "Winning Hunter",
};

// ─── Page ───────────────────────────────────────────────

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<Tab>("discover");

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
            <Search className="text-accent-indigo" size={20} strokeWidth={1.8} />
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

      {/* ─── Tab switcher ─── */}
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-1 border border-subtle mb-6">
        {([
          { id: "discover" as Tab, label: "Discover", icon: Compass },
          { id: "sheet" as Tab, label: "Research Sheet", icon: ClipboardList },
        ]).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md transition-colors duration-150",
                activeTab === tab.id
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="research-tab"
                  className="absolute inset-0 rounded-md bg-accent-indigo/15 ring-1 ring-accent-indigo/25"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={14} className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Tab content ─── */}
      <AnimatePresence mode="wait">
        {activeTab === "discover" ? (
          <motion.div
            key="discover"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <DiscoverTab />
          </motion.div>
        ) : (
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ResearchSheet />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Discover Tab ───────────────────────────────────────

function DiscoverTab() {
  const { discoveryResults, runResearch, removeDiscovery, importToSheet } =
    useResearchStore();

  const [source, setSource] = useState<Source>("afterlib");
  const [productCount, setProductCount] = useState(12);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(-1);
  const [hasSearched, setHasSearched] = useState(discoveryResults.length > 0);
  const scanLock = useRef(false);

  const scanSteps: ScanStep[] = useMemo(
    () => [
      { text: `Connecting to ${SOURCE_LABEL[source]}...`, duration: 800 },
      { text: "Scanning active ads...", duration: 1200 },
      { text: "Filtering by criteria...", duration: 1000 },
      { text: `Found ${productCount} candidates`, duration: 600 },
    ],
    [source, productCount]
  );

  const runScan = useCallback(async () => {
    if (scanLock.current) return;
    scanLock.current = true;

    setScanning(true);
    setScanStep(0);

    for (let i = 0; i < scanSteps.length; i++) {
      setScanStep(i);
      await new Promise((r) => setTimeout(r, scanSteps[i].duration));
    }

    setScanStep(scanSteps.length);
    await new Promise((r) => setTimeout(r, 350));

    runResearch(productCount);
    setScanning(false);
    setHasSearched(true);

    setTimeout(() => {
      scanLock.current = false;
    }, 600);
  }, [scanSteps, productCount, runResearch]);

  return (
    <div>
      {/* ─── Controls bar ─── */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-4 flex-wrap">
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
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{SOURCE_LABEL[s]}</span>
              </button>
            ))}
          </div>

          {/* Product count slider */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-text-muted whitespace-nowrap">
              Products:
            </label>
            <input
              type="range"
              min={5}
              max={15}
              value={productCount}
              onChange={(e) => setProductCount(Number(e.target.value))}
              className="w-24 sm:w-32 accent-[var(--accent-indigo)] h-1 cursor-pointer"
            />
            <span className="text-xs font-jetbrains font-semibold text-text-primary w-5 text-right tabular-nums">
              {productCount}
            </span>
          </div>
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
                {scanSteps.map((step, i) => {
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
                      {done ? (
                        <div className="w-5 h-5 rounded-full bg-accent-emerald/15 flex items-center justify-center shrink-0">
                          <Check size={11} strokeWidth={2.5} className="text-accent-emerald" />
                        </div>
                      ) : active ? (
                        <div className="w-5 h-5 rounded-full bg-accent-indigo/15 flex items-center justify-center shrink-0">
                          <Loader2 size={11} strokeWidth={2.5} className="text-accent-indigo animate-spin" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                        </div>
                      )}

                      <span
                        className={cn(
                          "text-[13px] font-mono-metric",
                          done ? "text-text-secondary" : active ? "text-text-primary" : "text-text-muted"
                        )}
                      >
                        {step.text}
                      </span>

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

      {/* ─── Results grid ─── */}
      {!scanning && hasSearched && (
        <>
          {discoveryResults.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-4 text-[11px] font-jetbrains tracking-wide">
                <span className="text-text-secondary">
                  <span className="text-text-primary font-semibold">
                    {discoveryResults.length}
                  </span>{" "}
                  products found
                </span>
                <span className="text-text-muted">
                  &middot; Import or decline each product
                </span>
              </div>

              <AnimatePresence>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {discoveryResults.map((product, i) => (
                    <ResearchCard
                      key={product.id}
                      product={product}
                      index={i}
                      onImport={importToSheet}
                      onDecline={removeDiscovery}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-accent-emerald/10 flex items-center justify-center mb-4">
                <Check size={20} className="text-accent-emerald" />
              </div>
              <p className="text-sm text-text-secondary mb-1">
                All products reviewed
              </p>
              <p className="text-xs text-text-muted">
                Run another research scan or check the Research Sheet
              </p>
            </div>
          )}
        </>
      )}

      {/* ─── Empty state (before first search) ─── */}
      {!scanning && !hasSearched && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-xl bg-accent-indigo/10 flex items-center justify-center mb-4">
            <Search size={24} className="text-accent-indigo/60" />
          </div>
          <p className="text-sm text-text-secondary mb-1">
            Ready to discover winning products
          </p>
          <p className="text-xs text-text-muted">
            Choose a source, set your product count, and hit Run Research
          </p>
        </div>
      )}
    </div>
  );
}
