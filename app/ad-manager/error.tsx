"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Ad Manager error:", error);
  }, [error]);

  const isConnectionError = error.message?.toLowerCase().includes("token") ||
    error.message?.toLowerCase().includes("auth") ||
    error.message?.toLowerCase().includes("401");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
      <div className="w-14 h-14 rounded-2xl bg-accent-red/10 flex items-center justify-center">
        <AlertTriangle size={28} strokeWidth={1.5} className="text-accent-red" />
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-xl font-syne font-bold text-text-primary">
          {isConnectionError ? "Connection Issue" : "Ad Manager Error"}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {isConnectionError
            ? "Your Meta Ads connection may have expired. Try reconnecting in Settings."
            : "Failed to load ad campaign data. This may be a temporary issue."}
        </p>
      </div>

      <div className="flex items-center gap-3">
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
        {isConnectionError && (
          <a
            href="/settings"
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl",
              "text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.1]",
              "text-text-primary border border-subtle",
              "transition-all duration-200"
            )}
          >
            <Settings size={14} />
            Settings
          </a>
        )}
      </div>
    </div>
  );
}
