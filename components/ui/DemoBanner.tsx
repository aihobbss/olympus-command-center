"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDemoStore } from "@/lib/store";

export function DemoBanner() {
  const { bannerVisible, dismissBanner } = useDemoStore();

  return (
    <AnimatePresence>
      {bannerVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 32, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const }}
          className="fixed top-0 left-0 right-0 z-[60] overflow-hidden"
        >
          <div className="h-8 bg-accent-indigo flex items-center justify-center px-4">
            <span className="text-[12px] font-medium text-white tracking-wide">
              Demo Mode{" "}
              <span className="text-white/60 mx-1.5">&mdash;</span>{" "}
              All data is simulated
            </span>
            <button
              onClick={dismissBanner}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Dismiss demo banner"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
