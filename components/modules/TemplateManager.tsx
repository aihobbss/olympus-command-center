"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { ConfirmModal } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SOPTemplate, SOPTemplateCategory } from "@/data/mock";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface TemplateManagerProps {
  templates: SOPTemplate[];
  onUpdate: (templates: SOPTemplate[]) => void;
}

const CATEGORIES: SOPTemplateCategory[] = [
  "Quality Issue",
  "Sizing",
  "Wrong Item",
  "Delivery",
  "Trustpilot",
];

const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  "Quality Issue": { bg: "bg-accent-red/15", text: "text-accent-red" },
  Sizing: { bg: "bg-white/[0.06]", text: "text-text-secondary" },
  "Wrong Item": { bg: "bg-accent-amber/15", text: "text-accent-amber" },
  Delivery: { bg: "bg-accent-indigo/15", text: "text-accent-indigo" },
  Trustpilot: { bg: "bg-accent-emerald/15", text: "text-accent-emerald" },
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function TemplateManager({ templates, onUpdate }: TemplateManagerProps) {
  const [filterCat, setFilterCat] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    templateId: string;
    name: string;
  }>({ open: false, templateId: "", name: "" });
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState<SOPTemplateCategory>("Quality Issue");
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");

  const filtered = useMemo(() => {
    if (filterCat === "All") return templates;
    return templates.filter((t) => t.category === filterCat);
  }, [templates, filterCat]);

  // ── Handlers ──

  function handleStartEdit(t: SOPTemplate) {
    setEditingId(t.id);
    setEditSubject(t.subject);
    setEditBody(t.body);
  }

  function handleSaveEdit() {
    if (!editingId) return;
    onUpdate(
      templates.map((t) =>
        t.id === editingId ? { ...t, subject: editSubject, body: editBody } : t
      )
    );
    setEditingId(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  function handleDeleteConfirm() {
    onUpdate(templates.filter((t) => t.id !== deleteModal.templateId));
    setDeleteModal({ open: false, templateId: "", name: "" });
  }

  function handleAddSave() {
    if (!newName.trim() || !newBody.trim()) return;
    const id = `sop-custom-${Date.now()}`;
    onUpdate([
      ...templates,
      {
        id,
        category: newCategory,
        name: newName.trim(),
        subject: newSubject.trim(),
        body: newBody.trim(),
        isDefault: false,
      },
    ]);
    setAdding(false);
    setNewName("");
    setNewSubject("");
    setNewBody("");
  }

  const selectClass = cn(
    "rounded-lg border border-subtle bg-white/[0.04]",
    "px-3 py-2 text-sm text-text-primary",
    "focus:outline-none focus:ring-1 focus:ring-accent-indigo/50"
  );

  return (
    <div className="rounded-xl border border-subtle overflow-hidden bg-bg-card">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
        <h3 className="text-base font-syne font-semibold text-text-primary">
          Email Templates
        </h3>
        <button
          onClick={() => setAdding(true)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            "bg-accent-indigo hover:bg-accent-indigo-hover text-white shadow-lg shadow-accent-indigo/20"
          )}
        >
          <Plus size={14} />
          Add Template
        </button>
      </div>

      {/* ── Category filter pills ── */}
      <div className="px-5 py-3 border-b border-subtle flex items-center gap-2 flex-wrap">
        {["All", ...CATEGORIES].map((cat) => {
          const active = filterCat === cat;
          const style = cat !== "All" ? CATEGORY_STYLE[cat] : null;

          return (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150",
                active
                  ? "ring-1 ring-accent-indigo"
                  : "",
                style
                  ? cn(style.bg, style.text)
                  : "bg-white/[0.06] text-text-secondary"
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── Add form ── */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-subtle bg-accent-indigo/[0.03]">
              <h4 className="text-sm font-syne font-semibold text-text-primary mb-3">
                New Template
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as SOPTemplateCategory)}
                  className={selectClass}
                  style={{ color: "var(--text-primary)", backgroundColor: "rgba(255,255,255,0.04)" }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} style={{ color: "#F1F1F3", backgroundColor: "#1A1A24" }}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Template name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={cn(selectClass, "placeholder:text-text-muted")}
                />
              </div>
              <input
                type="text"
                placeholder="Email subject line"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className={cn(selectClass, "w-full mb-3 placeholder:text-text-muted")}
              />
              <textarea
                placeholder="Email body (use [Customer's Name] for placeholder)"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={6}
                className={cn(
                  "w-full rounded-lg border border-subtle bg-white/[0.03]",
                  "px-4 py-3 text-sm text-text-primary leading-relaxed",
                  "focus:outline-none focus:ring-1 focus:ring-accent-indigo/50",
                  "resize-y min-h-[100px] mb-3",
                  "placeholder:text-text-muted"
                )}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddSave}
                  disabled={!newName.trim() || !newBody.trim()}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                    newName.trim() && newBody.trim()
                      ? "bg-accent-indigo/15 text-accent-indigo hover:bg-accent-indigo/25"
                      : "bg-white/[0.04] text-text-muted cursor-not-allowed"
                  )}
                >
                  <Check size={12} strokeWidth={2.5} />
                  Save
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setNewName("");
                    setNewSubject("");
                    setNewBody("");
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
                >
                  <X size={12} strokeWidth={2.5} />
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Template cards ── */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((t) => {
          const style = CATEGORY_STYLE[t.category] ?? CATEGORY_STYLE["Quality Issue"];
          const isEditing = editingId === t.id;

          return (
            <div
              key={t.id}
              className={cn(
                "rounded-lg border border-subtle p-4 transition-colors",
                isEditing
                  ? "bg-accent-indigo/[0.03] border-accent-indigo/20"
                  : "bg-white/[0.02] hover:bg-white/[0.03]"
              )}
            >
              {isEditing ? (
                /* ── Editing Mode ── */
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-text-primary">
                      {t.name}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        style.bg,
                        style.text
                      )}
                    >
                      {t.category}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Subject"
                    className={cn(selectClass, "w-full mb-2 placeholder:text-text-muted")}
                  />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={8}
                    className={cn(
                      "w-full rounded-lg border border-subtle bg-white/[0.03]",
                      "px-4 py-3 text-sm text-text-primary leading-relaxed",
                      "focus:outline-none focus:ring-1 focus:ring-accent-indigo/50",
                      "resize-y min-h-[120px] mb-2",
                      "placeholder:text-text-muted"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-accent-indigo/15 text-accent-indigo hover:bg-accent-indigo/25 transition-colors"
                    >
                      <Check size={11} strokeWidth={2.5} />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
                    >
                      <X size={11} strokeWidth={2.5} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text-primary">
                      {t.name}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        style.bg,
                        style.text
                      )}
                    >
                      {t.category}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary mb-2">
                    Subject: {t.subject}
                  </p>
                  <p className="text-[12px] text-text-muted line-clamp-3 mb-3 leading-relaxed">
                    {t.body}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStartEdit(t)}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-indigo hover:text-accent-indigo-hover transition-colors"
                    >
                      <Pencil size={11} strokeWidth={2} />
                      Edit
                    </button>
                    {!t.isDefault && (
                      <button
                        onClick={() =>
                          setDeleteModal({
                            open: true,
                            templateId: t.id,
                            name: t.name,
                          })
                        }
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-red hover:text-accent-red/80 transition-colors"
                      >
                        <Trash2 size={11} strokeWidth={2} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center">
            <p className="text-sm text-text-muted">
              No templates in this category.
            </p>
          </div>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      <ConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal((prev) => ({ ...prev, open: false }))}
        onConfirm={handleDeleteConfirm}
        title="Delete template?"
        description={`This will permanently remove "${deleteModal.name}". This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
