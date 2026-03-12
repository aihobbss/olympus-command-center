"use client";

import { useRef, useEffect, useState } from "react";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStoreContext, useAuthStore, useConnectionsStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const marketColors: Record<string, string> = {
  UK: "bg-accent-emerald/15 text-accent-emerald",
  AU: "bg-accent-amber/15 text-accent-amber",
  USA: "bg-accent-indigo/15 text-accent-indigo",
  EU: "bg-violet-500/15 text-violet-400",
  CA: "bg-rose-500/15 text-rose-400",
};

const marketDotColors: Record<string, string> = {
  UK: "bg-accent-emerald",
  AU: "bg-accent-amber",
  USA: "bg-accent-indigo",
  EU: "bg-violet-400",
  CA: "bg-rose-400",
};

type TopBarProps = {
  sidebarCollapsed: boolean;
  bannerOffset?: number;
};

export function TopBar({ sidebarCollapsed, bannerOffset = 0 }: TopBarProps) {
  const { stores, selectedStore, setSelectedStore, loadStores } = useStoreContext();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout) as () => void;
  const { getExpiryDaysLeft, loadConnections } = useConnectionsStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load connections to check expiry
  useEffect(() => {
    if (user) loadConnections();
  }, [user, loadConnections]);

  const metaDaysLeft = getExpiryDaysLeft("facebook");

  const hasMultipleStores = stores.length > 1;

  // Load stores on mount / when user changes
  useEffect(() => {
    loadStores();
  }, [loadStores, user?.storeIds]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!selectedStore) return null;

  return (
    <header
      className={cn(
        "fixed right-0 h-16 z-30 flex items-center justify-between px-5",
        "glass border-b border-subtle",
        "transition-[left,top] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        "left-0",
        sidebarCollapsed ? "lg:left-[72px]" : "lg:left-[260px]"
      )}
      style={{ top: bannerOffset }}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Mobile-only brand */}
        <div className="lg:hidden flex items-center gap-2 mr-2">
          <div className="w-6 h-6 rounded-md bg-accent-indigo/15 flex items-center justify-center">
            <div className="w-[5px] h-[5px] rounded-full bg-accent-indigo" />
          </div>
          <span className="font-syne text-[11px] font-bold tracking-[0.2em] text-text-primary uppercase">
            VANTAGE
          </span>
          <div className="w-px h-5 bg-[var(--border-subtle)] ml-1" />
        </div>

        {/* Store selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => hasMultipleStores && setDropdownOpen(!dropdownOpen)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg",
              "transition-colors duration-150",
              hasMultipleStores ? "hover:bg-white/[0.04] cursor-pointer" : "cursor-default"
            )}
          >
            {/* Market color dot */}
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                marketDotColors[selectedStore.market] ?? "bg-accent-indigo"
              )}
            />

            {/* Store name */}
            <span className="text-sm font-medium text-text-primary hidden sm:inline">
              {selectedStore.name}
            </span>
            <span className="text-sm font-medium text-text-primary sm:hidden">
              {selectedStore.name.split(" ")[0]}
            </span>

            {/* Market badge */}
            <span
              className={cn(
                "text-[10px] font-jetbrains font-semibold px-1.5 py-0.5 rounded",
                marketColors[selectedStore.market] ?? "bg-accent-indigo/15 text-accent-indigo"
              )}
            >
              {selectedStore.market}
            </span>

            {hasMultipleStores && (
              <ChevronDown
                size={14}
                className={cn(
                  "text-text-muted transition-transform duration-200",
                  dropdownOpen && "rotate-180"
                )}
              />
            )}
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 w-60 rounded-xl bg-bg-card border border-subtle shadow-2xl shadow-black/50 py-1.5 z-50"
              >
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => {
                      setSelectedStore(store);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3.5 py-2.5 text-left",
                      "hover:bg-white/[0.04] transition-colors duration-150",
                      selectedStore.id === store.id && "bg-accent-indigo/[0.06]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        marketDotColors[store.market] ?? "bg-accent-indigo"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">
                        {store.name}
                      </div>
                      <div className="text-[10px] text-text-muted font-jetbrains">
                        {store.market} &middot; {store.currency}
                      </div>
                    </div>
                    {selectedStore.id === store.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-indigo" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Meta token expiry warning */}
      {metaDaysLeft !== null && metaDaysLeft <= 7 && metaDaysLeft > 0 && (
        <a
          href="/settings"
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-amber/10 border border-accent-amber/20 text-accent-amber text-[11px] font-medium hover:bg-accent-amber/15 transition-colors"
        >
          <span>⚠</span>
          Meta token expires in {metaDaysLeft} day{metaDaysLeft !== 1 ? "s" : ""} — reconnect
        </a>
      )}
      {metaDaysLeft !== null && metaDaysLeft <= 0 && (
        <a
          href="/settings"
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-[11px] font-medium hover:bg-accent-red/15 transition-colors"
        >
          <span>⚠</span>
          Meta token expired — reconnect now
        </a>
      )}

      {/* Right section */}
      <div className="flex items-center gap-1.5">
        {/* Notification bell */}
        <button
          className={cn(
            "relative w-9 h-9 rounded-lg flex items-center justify-center",
            "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]",
            "transition-colors duration-150"
          )}
        >
          <Bell size={18} strokeWidth={1.7} />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-accent-amber ring-2 ring-bg-sidebar" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-[var(--border-subtle)] mx-1.5" />

        {/* User avatar */}
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center ring-2",
            user?.avatarGradient,
            "ring-accent-indigo/20"
          )}>
            <span className="text-white text-xs font-bold">{user?.initials}</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-text-primary leading-tight">
              {user?.name}
            </div>
            <div className="text-[10px] text-text-muted leading-tight capitalize">
              {user?.role ?? "Owner"}
            </div>
          </div>
          {/* Logout */}
          <button
            onClick={logout}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              "text-text-muted hover:text-accent-red hover:bg-accent-red/10",
              "transition-colors duration-150"
            )}
            title="Sign out"
          >
            <LogOut size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}
