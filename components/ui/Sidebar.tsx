"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  bannerOffset?: number;
  highlightedNavId?: string | null;
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function Sidebar({ collapsed, onToggle, bannerOffset = 0, highlightedNavId }: SidebarProps) {
  const pathname = usePathname();
  const visibleNavItems = navItems;

  return (
    <aside
      className={cn(
        "fixed left-0 z-40 hidden lg:flex flex-col overflow-hidden",
        "bg-bg-sidebar border-r border-subtle",
        "transition-[width,top] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
      style={{ top: bannerOffset, height: `calc(100vh - ${bannerOffset}px)` }}
    >
      {/* Left accent strip — indigo gradient fading down */}
      <div className="absolute left-0 top-0 w-[2px] h-full bg-gradient-to-b from-accent-indigo/60 via-accent-indigo/15 to-transparent pointer-events-none" />

      {/* Brand wordmark */}
      <motion.div
        className={cn(
          "flex items-center gap-3 pt-6 pb-8 shrink-0",
          collapsed ? "px-[21px]" : "px-5"
        )}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
      >
        {/* Indigo pulse dot */}
        <div className="relative w-[30px] h-[30px] rounded-lg bg-accent-indigo/15 flex items-center justify-center shrink-0">
          <div className="w-[7px] h-[7px] rounded-full bg-accent-indigo animate-[pulse-glow_3s_ease-in-out_infinite]" />
        </div>

        {/* OLYMPUS text — collapses with sidebar */}
        <span
          className={cn(
            "font-syne text-[13px] font-bold tracking-[0.25em] text-text-primary uppercase whitespace-nowrap",
            "transition-[opacity] duration-200",
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}
        >
          OLYMPUS
        </span>
      </motion.div>

      {/* Navigation items */}
      <motion.nav
        className="flex-1 px-3 overflow-y-auto overflow-x-hidden scrollbar-hide"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="space-y-0.5">
          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <motion.div key={item.id} variants={itemVariants}>
                <Link
                  href={item.href}
                  data-tour-id={item.id}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg py-2.5 text-[13px] font-medium",
                    "transition-all duration-200",
                    collapsed ? "px-0 justify-center" : "px-3",
                    isActive
                      ? "bg-accent-indigo/[0.08] text-text-primary"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]",
                    highlightedNavId === item.id &&
                      "ring-2 ring-accent-indigo/60 bg-accent-indigo/[0.12] text-text-primary relative z-[56] animate-[tour-glow_2s_ease-in-out_infinite]"
                  )}
                >
                  {/* Active indicator — animated between items */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-indigo"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}

                  {/* Icon */}
                  <Icon
                    size={19}
                    strokeWidth={1.8}
                    className={cn(
                      "shrink-0 transition-colors duration-200",
                      isActive
                        ? "text-accent-indigo"
                        : "text-text-muted group-hover:text-text-secondary"
                    )}
                  />

                  {/* Label — hidden when collapsed */}
                  <span
                    className={cn(
                      "truncate whitespace-nowrap overflow-hidden",
                      "transition-[opacity] duration-200",
                      collapsed ? "opacity-0 w-0" : "opacity-100"
                    )}
                  >
                    {item.label}
                  </span>

                  {/* Tooltip — only when collapsed, appears on hover */}
                  {collapsed && (
                    <div
                      className={cn(
                        "absolute left-full ml-3 px-3 py-1.5 rounded-lg",
                        "bg-bg-elevated border border-subtle",
                        "text-text-primary text-xs font-medium whitespace-nowrap",
                        "opacity-0 group-hover:opacity-100 pointer-events-none",
                        "transition-opacity duration-150 z-50",
                        "shadow-xl shadow-black/40"
                      )}
                    >
                      {item.label}
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.nav>

      {/* Collapse toggle */}
      <motion.div
        className="px-3 py-4 border-t border-subtle shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
      >
        <button
          onClick={onToggle}
          className={cn(
            "w-full flex items-center gap-2 rounded-lg py-2.5",
            "text-text-muted hover:text-text-secondary hover:bg-white/[0.03]",
            "transition-all duration-200",
            collapsed ? "px-0 justify-center" : "px-3"
          )}
        >
          {collapsed ? (
            <PanelLeft size={18} strokeWidth={1.6} />
          ) : (
            <PanelLeftClose size={18} strokeWidth={1.6} />
          )}
          <span
            className={cn(
              "text-xs whitespace-nowrap overflow-hidden",
              "transition-[opacity] duration-200",
              collapsed ? "opacity-0 w-0" : "opacity-100"
            )}
          >
            Collapse
          </span>
        </button>
      </motion.div>
    </aside>
  );
}
