"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionSliderProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export function ActionSlider({
  open,
  onClose,
  title,
  children,
  width,
  className,
}: ActionSliderProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Slide-in panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
            }}
            style={width ? { width } : undefined}
            className={cn(
              "fixed top-0 right-0 h-full",
              "bg-bg-card border-l border-subtle",
              "shadow-2xl shadow-black/40",
              "flex flex-col overflow-hidden",
              !width && "w-full sm:w-[420px]",
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle shrink-0">
              {title && (
                <h3 className="text-base font-syne font-semibold text-text-primary">
                  {title}
                </h3>
              )}
              <button
                onClick={onClose}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]",
                  "transition-colors duration-150",
                  !title && "ml-auto"
                )}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto p-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
