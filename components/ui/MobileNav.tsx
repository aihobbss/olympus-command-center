"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { navItems } from "@/lib/navigation";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  // Filter out admin-only nav items for non-coach users
  const visibleNavItems = navItems.filter(
    (item) => item.group !== "admin" || user?.role === "coach"
  );

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 h-[64px] z-40 lg:hidden",
        "glass border-t border-subtle",
        "flex items-center"
      )}
    >
      <div className="flex w-full overflow-x-auto scrollbar-hide">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          // Short label: first word only, or abbreviation for longer names
          const shortLabel =
            item.id === "product-creation"
              ? "Create"
              : item.id === "creative-generator"
                ? "Creative"
                : item.id === "customer-service"
                  ? "Support"
                  : item.id === "profit-tracker"
                    ? "Profit"
                    : item.id === "ad-manager"
                      ? "Ads"
                      : item.id === "coach-view"
                        ? "Coach"
                        : item.label;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex-1 min-w-[56px] flex flex-col items-center justify-center gap-0.5 py-1.5",
                "transition-colors duration-150",
                isActive ? "text-accent-indigo" : "text-text-muted"
              )}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2 : 1.6} />
                {isActive && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-indigo" />
                )}
              </div>
              <span className="text-[9px] font-medium tracking-wide">
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
