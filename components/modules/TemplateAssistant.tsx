"use client";

import { useState, useMemo } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SOPTemplate, CustomerCase } from "@/data/mock";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface TemplateAssistantProps {
  classification: CustomerCase["classification"];
  customerName: string;
  templates: SOPTemplate[];
  value: string;
  onChange: (text: string) => void;
  storePrefix?: string;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const CATEGORIES = ["Quality Issue", "Sizing", "Wrong Item", "Delivery", "Trustpilot"] as const;

function firstName(fullName: string): string {
  return fullName.split(" ")[0];
}

function generateCode(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-SIZE50-${code}`;
}

function processTemplate(body: string, customerName: string, prefix: string): string {
  return body
    .replace(/\[Customer's Name\]/g, firstName(customerName))
    .replace(/\[CODE\]/g, generateCode(prefix));
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function TemplateAssistant({
  classification,
  customerName,
  templates,
  storePrefix = "VANTAGE",
  value,
  onChange,
}: TemplateAssistantProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(classification);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const categoryTemplates = useMemo(() => {
    return templates.filter((t) => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  // Auto-select first template when category changes
  const activeTemplateId =
    selectedTemplateId && categoryTemplates.some((t) => t.id === selectedTemplateId)
      ? selectedTemplateId
      : categoryTemplates[0]?.id ?? "";

  function handleCategoryChange(cat: string) {
    setSelectedCategory(cat);
    setSelectedTemplateId("");
  }

  function handleGenerate() {
    const tpl = templates.find((t) => t.id === activeTemplateId);
    if (!tpl) return;
    onChange(processTemplate(tpl.body, customerName, storePrefix));
  }

  const selectClass = cn(
    "rounded-lg border border-subtle bg-white/[0.04]",
    "px-3 py-2 text-sm text-text-primary",
    "focus:outline-none focus:ring-1 focus:ring-accent-indigo/50",
    "appearance-none cursor-pointer"
  );

  return (
    <div className="px-5 py-4 border-b border-subtle flex-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Send size={14} strokeWidth={1.8} className="text-text-muted" />
        <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          Template Assistant
        </h4>
        <span className="text-[10px] text-accent-indigo bg-accent-indigo/10 px-2 py-0.5 rounded-full font-medium ml-1">
          AI Powered
        </span>
      </div>

      {/* Selector row */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Category dropdown */}
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className={selectClass}
          style={{ color: "var(--text-primary)", backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat} style={{ color: "#F1F1F3", backgroundColor: "#1A1A24" }}>
              {cat}
            </option>
          ))}
        </select>

        {/* Sub-template dropdown */}
        <select
          value={activeTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
          className={selectClass}
          style={{ color: "var(--text-primary)", backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          {categoryTemplates.map((t) => (
            <option key={t.id} value={t.id} style={{ color: "#F1F1F3", backgroundColor: "#1A1A24" }}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!activeTemplateId}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            activeTemplateId
              ? "bg-accent-indigo hover:bg-accent-indigo-hover text-white shadow-lg shadow-accent-indigo/20"
              : "bg-white/[0.04] text-text-muted cursor-not-allowed"
          )}
        >
          <Sparkles size={14} />
          Generate
        </button>
      </div>

      {/* Editable textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="Select a template and click Generate, or type your response..."
        className={cn(
          "w-full rounded-lg border border-subtle bg-white/[0.03]",
          "px-4 py-3 text-sm text-text-primary leading-relaxed",
          "focus:outline-none focus:ring-1 focus:ring-accent-indigo/50",
          "resize-y min-h-[140px]",
          "placeholder:text-text-muted"
        )}
      />
    </div>
  );
}
