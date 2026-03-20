"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store, ArrowLeft, Clock, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { LoginScreen } from "./LoginScreen";
import { StoreSetup } from "./StoreSetup";
import { useAuthStore, useCoachViewStore, useConnectionsStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ServiceId } from "@/lib/services/connections";

function ApprovalGate() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent-indigo)_0%,_transparent_70%)] opacity-[0.03] pointer-events-none" />
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl p-8 bg-bg-card border border-subtle text-center">
        <div className="w-14 h-14 rounded-full bg-accent-amber/15 flex items-center justify-center mx-auto mb-5">
          <Clock size={24} className="text-accent-amber" />
        </div>
        <h2 className="font-syne text-xl font-bold text-text-primary mb-2">
          Pending Approval
        </h2>
        <p className="text-sm text-text-secondary mb-1">
          Hey {user?.name}, your account has been created successfully.
        </p>
        <p className="text-sm text-text-secondary mb-6">
          An admin needs to approve your account before you can access the command center. Check back soon.
        </p>
        <button
          onClick={() => logout()}
          className={cn(
            "w-full px-4 py-3 rounded-xl text-sm font-medium",
            "bg-white/[0.06] text-text-secondary border border-subtle",
            "hover:bg-white/[0.08] transition-all duration-200"
          )}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Service display names ──────────────────────────────
const SERVICE_LABELS: Record<ServiceId, string> = {
  shopify: "Shopify",
  facebook: "Facebook",
  nanobanana: "Nanobanana Pro",
  anthropic: "Claude API",
};

function formatTimeLeft(hoursLeft: number): string {
  if (hoursLeft <= 0) return "has expired";
  if (hoursLeft < 1) return "expires in less than 1 hour";
  if (hoursLeft < 24) return `expires in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`;
  const days = Math.ceil(hoursLeft / 24);
  return `expires in ${days} day${days === 1 ? "" : "s"}`;
}

function TokenExpiryBanner() {
  const [dismissed, setDismissed] = useState(false);
  const expiring = useConnectionsStore((s) => s.getExpiringServices(24));

  if (dismissed || expiring.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={cn(
          "mx-6 mt-4 mb-0 rounded-xl border px-4 py-3",
          "bg-[var(--bg-elevated)] border-[var(--accent-amber)]/30"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <AlertTriangle size={16} className="text-[var(--accent-amber)]" />
          </div>
          <div className="flex-1 min-w-0">
            {expiring.map(({ service, hoursLeft }) => (
              <p key={service} className="text-sm text-[var(--text-primary)]">
                Your <span className="font-medium">{SERVICE_LABELS[service]}</span> connection{" "}
                {formatTimeLeft(hoursLeft)}.{" "}
                <Link
                  href="/settings"
                  className="text-[var(--accent-amber)] hover:underline font-medium"
                >
                  Reconnect
                </Link>{" "}
                <span className="text-[var(--text-secondary)]">to avoid disruption.</span>
              </p>
            ))}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className={cn(
              "shrink-0 p-1 rounded-md transition-colors",
              "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
              "hover:bg-white/[0.06]"
            )}
            aria-label="Dismiss warning"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);
  const router = useRouter();
  const coachActive = useCoachViewStore((s) => s.active);
  const coachStoreName = useCoachViewStore((s) => s.storeName);
  const coachOwnerName = useCoachViewStore((s) => s.ownerName);
  const exitCoachView = useCoachViewStore((s) => s.exit);

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading spinner while checking auth
  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-indigo/30 border-t-accent-indigo rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if no user
  if (!user) {
    return <LoginScreen />;
  }

  // Show approval gate if user isn't approved
  if (!user.approved) {
    return <ApprovalGate />;
  }

  // Show store setup if user has no stores
  if (user.storeIds.length === 0) {
    return <StoreSetup />;
  }

  const bannerOffset = coachActive ? 32 : 0;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Banner slot — coach view takes priority over demo banner */}
      {coachActive ? (
        <div className="fixed top-0 left-0 right-0 z-[60] h-8 flex items-center justify-between px-4 bg-accent-emerald/15 border-b border-accent-emerald/25">
          <div className="flex items-center gap-2">
            <Store size={13} strokeWidth={2} className="text-accent-emerald shrink-0" />
            <span className="text-[12px] font-medium text-accent-emerald">
              Coach View
              <span className="text-accent-emerald/50 mx-1.5">&middot;</span>
              {coachStoreName}
              <span className="text-accent-emerald/50 mx-1.5">&middot;</span>
              {coachOwnerName}&apos;s Store
            </span>
          </div>
          <button
            onClick={() => { exitCoachView(); router.push("/collaborators"); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-accent-emerald hover:bg-accent-emerald/20 transition-colors"
          >
            <ArrowLeft size={12} strokeWidth={2.5} />
            Exit
          </button>
        </div>
      ) : null}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        bannerOffset={bannerOffset}
      />
      <TopBar sidebarCollapsed={collapsed} bannerOffset={bannerOffset} />

      <main
        className={cn(
          "min-h-screen",
          "transition-[padding-left,padding-top] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]",
          "pb-[72px] lg:pb-0"
        )}
        style={{ paddingTop: 64 + bannerOffset }}
      >
        <TokenExpiryBanner />
        <div className="p-6">{children}</div>
      </main>

      <MobileNav />
    </div>
  );
}
