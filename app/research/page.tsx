"use client";

import { Search } from "lucide-react";
import { ResearchSheet } from "@/components/modules/ResearchSheet";

export default function ResearchPage() {
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
              Track and manage your product research pipeline
            </p>
          </div>
        </div>
      </div>

      <ResearchSheet />
    </div>
  );
}
