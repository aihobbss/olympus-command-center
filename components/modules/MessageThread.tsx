"use client";

import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseMessage } from "@/data/mock";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface MessageThreadProps {
  messages: CaseMessage[];
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function MessageThread({ messages }: MessageThreadProps) {
  return (
    <div className="px-5 py-4 border-b border-subtle">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={14} strokeWidth={1.8} className="text-text-muted" />
        <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          Conversation
        </h4>
        <span className="text-[10px] text-text-muted font-jetbrains">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Messages */}
      <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
        {messages.map((msg, idx) => {
          const isAgent = msg.sender === "agent";

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.2 }}
              className={cn(
                "rounded-lg px-4 py-3",
                isAgent
                  ? "bg-accent-indigo/[0.04] border border-accent-indigo/10 border-l-2 border-l-accent-indigo/30"
                  : "bg-white/[0.02] border border-subtle"
              )}
            >
              {/* Sender row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isAgent ? "text-accent-indigo" : "text-text-primary"
                    )}
                  >
                    {msg.senderName}
                  </span>
                  {isAgent && (
                    <span className="text-[10px] text-accent-indigo bg-accent-indigo/10 px-2 py-0.5 rounded-full font-medium">
                      SOP Reply
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted font-jetbrains shrink-0">
                  {relativeTime(msg.sentAt)}
                </span>
              </div>

              {/* Body */}
              <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
                {msg.body}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
