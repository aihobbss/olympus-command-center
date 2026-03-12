"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CreativeGeneratorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Creative Generator error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
      <div className="w-14 h-14 rounded-2xl bg-accent-red/10 flex items-center justify-center">
        <AlertTriangle size={28} strokeWidth={1.5} className="text-accent-red" />
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-xl font-syne font-bold text-text-primary">
          Creative Generator Error
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Something went wrong loading the creative generator. Try refreshing.
        </p>
      </div>

      <button
        onClick={reset}
        className={cn(
          "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl",
          "text-sm font-semibold bg-accent-indigo hover:bg-accent-indigo-hover",
          "text-white shadow-lg shadow-accent-indigo/25",
          "transition-all duration-200"
        )}
      >
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  );
}
