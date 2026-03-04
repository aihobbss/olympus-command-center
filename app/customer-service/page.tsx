"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Send,
  Check,
  AlertTriangle,
  ShieldAlert,
  Package,
  User,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui";
import {
  customerCases,
  DEFAULT_SOP_TEMPLATES,
  type CustomerCase,
  type SOPTemplate,
} from "@/data/mock";
import { cn } from "@/lib/utils";
import { useStoreContext } from "@/lib/store";
import { MessageThread } from "@/components/modules/MessageThread";
import { TemplateAssistant } from "@/components/modules/TemplateAssistant";
import { TemplateManager } from "@/components/modules/TemplateManager";

// ─── Constants ──────────────────────────────────────────────

const CLASSIFICATION_STYLE: Record<
  CustomerCase["classification"],
  { bg: string; text: string }
> = {
  "Quality Issue": {
    bg: "bg-accent-red/15",
    text: "text-accent-red",
  },
  "Wrong Item": {
    bg: "bg-accent-amber/15",
    text: "text-accent-amber",
  },
  Sizing: {
    bg: "bg-white/[0.06]",
    text: "text-text-secondary",
  },
  Delivery: {
    bg: "bg-accent-indigo/15",
    text: "text-accent-indigo",
  },
};

// Approximate product prices for refund calculations
const PRODUCT_PRICES: Record<string, number> = {
  "Maven Bomber Jacket": 65,
  "Harrington Trainers": 48,
  "Haldrin Layered Shirt": 42,
  "Durango Road Sneakers": 38,
  "Avalon Puffer Vest": 55,
};

type RefundType = "30%" | "50%" | "70%" | "store-credit";
type Tab = "inbox" | "templates";

const TAB_OPTIONS: { key: Tab; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "templates", label: "Templates" },
];

// ─── Helpers ────────────────────────────────────────────────

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Page ───────────────────────────────────────────────────

export default function CustomerServicePage() {
  const { selectedStore } = useStoreContext();
  const currency = selectedStore.currency;

  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [selectedId, setSelectedId] = useState<string>(customerCases[0].id);
  const [caseStatuses, setCaseStatuses] = useState<
    Record<string, "open" | "resolved">
  >({});
  const [responseTexts, setResponseTexts] = useState<Record<string, string>>(
    {}
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [templates, setTemplates] = useState<SOPTemplate[]>(DEFAULT_SOP_TEMPLATES);

  // Refund modal state
  const [refundModal, setRefundModal] = useState<{
    open: boolean;
    type: RefundType;
    amount: number;
    customerName: string;
    caseId: string;
  }>({ open: false, type: "30%", amount: 0, customerName: "", caseId: "" });

  const selectedCase = useMemo(
    () => customerCases.find((c) => c.id === selectedId) ?? null,
    [selectedId]
  );

  // Initialize response text when selecting a new case
  useEffect(() => {
    if (selectedCase && !(selectedCase.id in responseTexts)) {
      setResponseTexts((prev) => ({
        ...prev,
        [selectedCase.id]: "",
      }));
    }
    setSent(false);
    setSending(false);
  }, [selectedCase, responseTexts]);

  const currentResponse = selectedCase
    ? responseTexts[selectedCase.id] ?? ""
    : "";

  const isResolved = (id: string) => caseStatuses[id] === "resolved";

  // ── Handlers ──

  const handleSelectCase = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleResponseChange = useCallback(
    (text: string) => {
      if (!selectedCase) return;
      setResponseTexts((prev) => ({ ...prev, [selectedCase.id]: text }));
    },
    [selectedCase]
  );

  const handleSendReply = useCallback(async () => {
    if (!selectedCase || sending) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    setSent(true);
  }, [selectedCase, sending]);

  const handleOpenRefund = useCallback(
    (type: RefundType) => {
      if (!selectedCase) return;
      const price = PRODUCT_PRICES[selectedCase.product] ?? 50;
      let amount: number;
      if (type === "30%") amount = Math.round(price * 0.3 * 100) / 100;
      else if (type === "50%") amount = Math.round(price * 0.5 * 100) / 100;
      else if (type === "70%") amount = Math.round(price * 0.7 * 100) / 100;
      else amount = price; // store-credit = full price

      setRefundModal({
        open: true,
        type,
        amount,
        customerName: selectedCase.customerName,
        caseId: selectedCase.id,
      });
    },
    [selectedCase]
  );

  const handleConfirmRefund = useCallback(() => {
    setCaseStatuses((prev) => ({
      ...prev,
      [refundModal.caseId]: "resolved",
    }));
  }, [refundModal.caseId]);

  const handleMarkResolved = useCallback(() => {
    if (!selectedCase) return;
    setCaseStatuses((prev) => ({
      ...prev,
      [selectedCase.id]: "resolved",
    }));
  }, [selectedCase]);

  // ─── Render ───────────────────────────────────────────────

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
          <MessageSquare
            className="text-accent-indigo"
            size={20}
            strokeWidth={1.8}
          />
        </div>
        <div>
          <h1 className="text-2xl font-syne font-bold tracking-tight">
            Customer Service
          </h1>
          <p className="text-sm text-text-secondary">
            Unified inbox with SOP-drafted responses
          </p>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="flex items-center gap-1 mb-6 border-b border-subtle">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.key
                ? "text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="cs-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-indigo rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ─── Inbox Tab ─── */}
      {activeTab === "inbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-0 rounded-xl border border-subtle overflow-hidden bg-bg-card min-h-[680px]">
          {/* ━━━━ LEFT — Inbox ━━━━ */}
          <div className="border-b lg:border-b-0 lg:border-r border-subtle overflow-y-auto">
            <div className="px-4 py-3 border-b border-subtle">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Inbox
              </h3>
            </div>
            {customerCases.map((c) => {
              const active = c.id === selectedId;
              const resolved = isResolved(c.id);
              const style = CLASSIFICATION_STYLE[c.classification];

              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCase(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3.5 border-b border-subtle last:border-b-0",
                    "transition-colors duration-100 relative",
                    active
                      ? "bg-accent-indigo/[0.06]"
                      : "hover:bg-white/[0.02]",
                    resolved && "opacity-60"
                  )}
                >
                  {/* Active indicator */}
                  {active && (
                    <motion.div
                      layoutId="inbox-indicator"
                      className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent-indigo rounded-r-full"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold",
                        active
                          ? "bg-accent-indigo/20 text-accent-indigo"
                          : "bg-white/[0.06] text-text-muted"
                      )}
                    >
                      {initials(c.customerName)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span
                          className={cn(
                            "text-sm font-medium truncate",
                            active
                              ? "text-text-primary"
                              : "text-text-secondary"
                          )}
                        >
                          {c.customerName}
                        </span>
                        <span className="text-[10px] text-text-muted font-jetbrains shrink-0">
                          {relativeTime(c.receivedAt)}
                        </span>
                      </div>
                      <p className="text-[12px] text-text-secondary truncate mb-1.5">
                        {c.subject}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                            style.bg,
                            style.text
                          )}
                        >
                          {c.classification}
                        </span>
                        {c.messages.length > 1 && (
                          <span className="text-[10px] text-text-muted font-jetbrains">
                            {c.messages.length} msgs
                          </span>
                        )}
                        {resolved && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent-emerald/15 text-accent-emerald">
                            <Check size={9} strokeWidth={3} />
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ━━━━ RIGHT — Case View ━━━━ */}
          <div className="flex flex-col overflow-y-auto">
            {selectedCase ? (
              <>
                {/* ── Customer Profile ── */}
                <div className="p-5 border-b border-subtle">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-full bg-accent-indigo/15 flex items-center justify-center shrink-0">
                      <User
                        size={18}
                        strokeWidth={1.8}
                        className="text-accent-indigo"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-syne font-semibold text-text-primary">
                        {selectedCase.customerName}
                      </h3>
                      <p className="text-[12px] text-text-muted font-jetbrains mt-0.5">
                        {selectedCase.email}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[12px]">
                        <span className="text-text-secondary">
                          <span className="font-semibold text-text-primary">
                            {selectedCase.orderCount}
                          </span>{" "}
                          orders
                        </span>
                        <span className="text-text-muted">&middot;</span>
                        <span className="text-text-secondary">
                          <span className="font-semibold text-text-primary font-jetbrains">
                            {currency}{selectedCase.lifetimeValue}
                          </span>{" "}
                          lifetime value
                        </span>
                      </div>

                      {/* Prior refunds */}
                      {selectedCase.previousRefunds !== "None" && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <AlertTriangle
                            size={12}
                            className="text-accent-amber shrink-0"
                          />
                          <span className="text-[11px] text-accent-amber font-medium">
                            {selectedCase.previousRefunds}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Repeat claimer banner */}
                  {selectedCase.isRepeatClaimer && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-red/[0.08] border border-accent-red/20 px-3 py-2">
                      <ShieldAlert
                        size={14}
                        className="text-accent-red shrink-0"
                      />
                      <p className="text-[11px] text-accent-red font-medium">
                        Repeat claimer — review carefully before issuing
                        refund
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Order Details ── */}
                <div className="px-5 py-4 border-b border-subtle">
                  <div className="flex items-center gap-2 mb-3">
                    <Package
                      size={14}
                      strokeWidth={1.8}
                      className="text-text-muted"
                    />
                    <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      Order Details
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">
                        Order
                      </span>
                      <span className="text-sm text-text-primary font-jetbrains font-medium">
                        {selectedCase.orderNumber}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">
                        Product
                      </span>
                      <span className="text-sm text-text-primary font-medium">
                        {selectedCase.product}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">
                        Ordered
                      </span>
                      <span className="text-sm text-text-secondary font-jetbrains">
                        {formatDate(selectedCase.orderDate)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">
                        Tracking
                      </span>
                      <span className="text-sm text-text-secondary">
                        {selectedCase.trackingStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Message Thread ── */}
                <MessageThread messages={selectedCase.messages} />

                {/* ── Template Assistant ── */}
                <TemplateAssistant
                  classification={selectedCase.classification}
                  customerName={selectedCase.customerName}
                  templates={templates}
                  value={currentResponse}
                  onChange={handleResponseChange}
                  storePrefix={selectedStore.market === "AU" ? "VANTAGE" : "OLYMPUS"}
                />

                {/* ── Action Bar ── */}
                <div className="px-5 py-4 border-t border-subtle bg-white/[0.01]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Send Reply */}
                    <AnimatePresence mode="wait">
                      {sent ? (
                        <motion.div
                          key="sent"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-emerald/15 text-accent-emerald"
                        >
                          <CheckCircle2 size={15} strokeWidth={2} />
                          Sent
                        </motion.div>
                      ) : (
                        <motion.button
                          key="send"
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={handleSendReply}
                          disabled={
                            sending || isResolved(selectedCase.id)
                          }
                          className={cn(
                            "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            sending
                              ? "bg-accent-indigo/30 text-accent-indigo cursor-not-allowed"
                              : "bg-accent-indigo hover:bg-accent-indigo-hover text-white shadow-lg shadow-accent-indigo/20"
                          )}
                        >
                          {sending ? (
                            <Loader2
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Send size={14} />
                          )}
                          {sending ? "Sending..." : "Send Reply"}
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Divider */}
                    <div className="w-px h-6 bg-subtle mx-1" />

                    {/* 30% Refund */}
                    <button
                      onClick={() => handleOpenRefund("30%")}
                      disabled={isResolved(selectedCase.id)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-[12px] font-medium transition-colors",
                        isResolved(selectedCase.id)
                          ? "bg-white/[0.03] text-text-muted cursor-not-allowed"
                          : "bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20"
                      )}
                    >
                      30% Refund
                    </button>

                    {/* 50% Refund */}
                    <button
                      onClick={() => handleOpenRefund("50%")}
                      disabled={isResolved(selectedCase.id)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-[12px] font-medium transition-colors",
                        isResolved(selectedCase.id)
                          ? "bg-white/[0.03] text-text-muted cursor-not-allowed"
                          : "bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20"
                      )}
                    >
                      50% Refund
                    </button>

                    {/* 70% Refund */}
                    <button
                      onClick={() => handleOpenRefund("70%")}
                      disabled={isResolved(selectedCase.id)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-[12px] font-medium transition-colors",
                        isResolved(selectedCase.id)
                          ? "bg-white/[0.03] text-text-muted cursor-not-allowed"
                          : "bg-accent-red/10 text-accent-red hover:bg-accent-red/20"
                      )}
                    >
                      70% Refund
                    </button>

                    {/* 100% Store Credit */}
                    <button
                      onClick={() => handleOpenRefund("store-credit")}
                      disabled={isResolved(selectedCase.id)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-[12px] font-medium transition-colors",
                        isResolved(selectedCase.id)
                          ? "bg-white/[0.03] text-text-muted cursor-not-allowed"
                          : "bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20"
                      )}
                    >
                      100% Store Credit
                    </button>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Mark Resolved */}
                    {isResolved(selectedCase.id) ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-accent-emerald font-medium">
                        <CheckCircle2 size={14} />
                        Resolved
                      </span>
                    ) : (
                      <button
                        onClick={handleMarkResolved}
                        className="px-3 py-2 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-text-muted">
                  Select a case to view
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Templates Tab ─── */}
      {activeTab === "templates" && (
        <TemplateManager templates={templates} onUpdate={setTemplates} />
      )}

      {/* ─── Refund Confirmation Modal ─── */}
      <ConfirmModal
        open={refundModal.open}
        onClose={() =>
          setRefundModal((prev) => ({ ...prev, open: false }))
        }
        onConfirm={handleConfirmRefund}
        title={refundModal.type === "store-credit" ? "Issue 100% store credit?" : `Issue ${refundModal.type} refund?`}
        description={
          refundModal.type === "store-credit"
            ? `Issue ${currency}${refundModal.amount.toFixed(2)} store credit to ${refundModal.customerName}. This will be added to their account and cannot be undone.`
            : `Issue ${currency}${refundModal.amount.toFixed(2)} refund to ${refundModal.customerName}. This will be processed via Shopify and cannot be undone.`
        }
        confirmLabel={
          refundModal.type === "store-credit"
            ? `Credit ${currency}${refundModal.amount.toFixed(2)}`
            : `Refund ${currency}${refundModal.amount.toFixed(2)}`
        }
        variant="danger"
      />
    </div>
  );
}
