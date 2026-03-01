"use client";

import { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronDown, Compass, ShieldCheck, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mockStores } from "@/lib/navigation";
import { useStoreContext, useDemoStore, useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const marketColors: Record<string, string> = {
  UK: "bg-accent-emerald/15 text-accent-emerald",
  AU: "bg-accent-amber/15 text-accent-amber",
  USA: "bg-accent-indigo/15 text-accent-indigo",
};

type TopBarProps = {
  sidebarCollapsed: boolean;
  bannerOffset?: number;
};

export function TopBar({ sidebarCollapsed, bannerOffset = 0 }: TopBarProps) {
  const pathname = usePathname();
  const isCoachView = pathname === "/coach-view";
  const { selectedStore, setSelectedStore } = useStoreContext();
  const { startTour } = useDemoStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show stores the current user has access to
  const userStores = mockStores.filter(
    (s) => user?.storeIds.includes(s.id)
  );
  const hasMultipleStores = userStores.length > 1;

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
            OLYMPUS
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
                selectedStore.market === "UK"
                  ? "bg-accent-emerald"
                  : selectedStore.market === "AU"
                    ? "bg-accent-amber"
                    : "bg-accent-indigo"
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
                marketColors[selectedStore.market]
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
                {userStores.map((store) => (
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
                        store.market === "UK"
                          ? "bg-accent-emerald"
                          : store.market === "AU"
                            ? "bg-accent-amber"
                            : "bg-accent-indigo"
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

      {/* Right section */}
      <div className="flex items-center gap-1.5">
        {/* Take a Tour */}
        <button
          onClick={startTour}
          className={cn(
            "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150",
            "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]"
          )}
        >
          <Compass size={13} strokeWidth={2} />
          Take a Tour
        </button>

        <div className="hidden sm:block w-px h-5 bg-[var(--border-subtle)]" />

        {/* Coach View toggle — only for coaches */}
        {user?.role === "coach" && (
          <Link
            href={isCoachView ? "/research" : "/coach-view"}
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150",
              isCoachView
                ? "bg-accent-indigo/15 text-accent-indigo"
                : "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]"
            )}
          >
            <ShieldCheck size={13} strokeWidth={2} />
            {isCoachView ? "Coach Mode" : "Coach View"}
          </Link>
        )}

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
            user?.role === "coach" ? "ring-accent-indigo/20" : "ring-accent-emerald/20"
          )}>
            <span className="text-white text-xs font-bold">{user?.initials}</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-text-primary leading-tight">
              {user?.name}
            </div>
            <div className="text-[10px] text-text-muted leading-tight capitalize">
              {user?.role === "coach"
                ? isCoachView ? "Coach" : "Owner"
                : "Owner"}
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
