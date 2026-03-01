"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { useDemoStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type TourStepData = {
  navId: string;
  route: string;
  title: string;
  description: string;
};

const TOUR_STEPS: TourStepData[] = [
  {
    navId: "research",
    route: "/research",
    title: "Research",
    description:
      "Scout winning products from competitors — see what's trending before anyone else.",
  },
  {
    navId: "import",
    route: "/import",
    title: "Import",
    description:
      "One-click import from your research directly into your store pipeline.",
  },
  {
    navId: "product-creation",
    route: "/product-creation",
    title: "Product Creation",
    description:
      "Build product listings with AI-assisted descriptions, pricing, and variants.",
  },
  {
    navId: "ad-manager",
    route: "/ad-manager",
    title: "Ad Manager",
    description:
      "Your live campaigns with SOP-based recommendations — Scale, Kill, or Watch in seconds.",
  },
  {
    navId: "profit-tracker",
    route: "/profit-tracker",
    title: "Profit Tracker",
    description:
      "Real-time P&L across every order — know your true margin, not just revenue.",
  },
  {
    navId: "creative-generator",
    route: "/creative-generator",
    title: "Creative Generator",
    description:
      "Generate 15 ad creatives in one click instead of 30 minutes manually.",
  },
  {
    navId: "customer-service",
    route: "/customer-service",
    title: "Customer Service",
    description:
      "AI-drafted responses with refund SOPs — handle tickets in under a minute.",
  },
  {
    navId: "coach-view",
    route: "/coach-view",
    title: "Coach View",
    description:
      "Monitor all student stores from one dashboard — step in when someone needs help.",
  },
];

export { TOUR_STEPS };

export function TourOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const { tourActive, tourStep, nextStep, prevStep, endTour } = useDemoStore();
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const currentStepData = tourActive ? TOUR_STEPS[tourStep] : null;
  const isLast = tourStep === 7;

  // Navigate to the correct route when tourStep changes
  useEffect(() => {
    if (!tourActive || !currentStepData) return;
    if (pathname !== currentStepData.route) {
      router.push(currentStepData.route);
    }
  }, [tourActive, tourStep, currentStepData, pathname, router]);

  // Position tooltip next to the highlighted sidebar item
  useEffect(() => {
    if (!tourActive || !currentStepData) return;

    const positionTooltip = () => {
      const el = document.querySelector(
        `[data-tour-id="${currentStepData.navId}"]`
      );
      if (!el) return;

      const rect = el.getBoundingClientRect();
      setTooltipPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 16,
      });
    };

    // Small delay to let route transition settle
    const timer = setTimeout(positionTooltip, 80);
    window.addEventListener("resize", positionTooltip);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", positionTooltip);
    };
  }, [tourActive, tourStep, currentStepData]);

  const handleNext = useCallback(() => {
    if (isLast) {
      endTour();
    } else {
      nextStep();
    }
  }, [isLast, nextStep, endTour]);

  // Keyboard navigation
  useEffect(() => {
    if (!tourActive) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") endTour();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft" && tourStep > 0) prevStep();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tourActive, tourStep, handleNext, prevStep, endTour]);

  if (!tourActive) return null;

  return (
    <div className="fixed inset-0 z-[55] hidden lg:block">
      {/* Semi-transparent backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
        onClick={endTour}
      />

      {/* Tooltip card */}
      <motion.div
        key={tourStep}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const }}
        className="absolute z-[56] w-[320px]"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          transform: "translateY(-50%)",
        }}
      >
        <div className="bg-bg-card border border-subtle rounded-xl shadow-2xl shadow-black/50 p-5">
          {/* Step counter + close */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-jetbrains text-accent-indigo font-semibold">
              {tourStep + 1} / 8
            </span>
            <button
              onClick={endTour}
              className="w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-white/[0.04] transition-colors"
              aria-label="Close tour"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>

          {/* Title */}
          <h4 className="text-base font-syne font-bold text-text-primary mb-1.5">
            {currentStepData?.title}
          </h4>

          {/* Description */}
          <p className="text-[13px] text-text-secondary leading-relaxed mb-5">
            {currentStepData?.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1 mb-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === tourStep
                    ? "w-4 bg-accent-indigo"
                    : i < tourStep
                      ? "w-1.5 bg-accent-indigo/40"
                      : "w-1.5 bg-white/[0.08]"
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={endTour}
              className="text-[12px] text-text-muted hover:text-text-secondary transition-colors"
            >
              Skip Tour
            </button>

            <div className="flex items-center gap-2">
              {tourStep > 0 && (
                <button
                  onClick={prevStep}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
                >
                  <ChevronLeft size={12} />
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-accent-indigo hover:bg-accent-indigo-hover text-white transition-colors shadow-lg shadow-accent-indigo/25"
              >
                {isLast ? "Finish" : "Next"}
                {!isLast && <ChevronRight size={12} />}
              </button>
            </div>
          </div>
        </div>

        {/* Arrow pointing left toward the sidebar item */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full"
          style={{ marginLeft: "-4px" }}
        >
          <div
            className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px]"
            style={{ borderRightColor: "var(--bg-card)" }}
          />
        </div>
      </motion.div>
    </div>
  );
}
