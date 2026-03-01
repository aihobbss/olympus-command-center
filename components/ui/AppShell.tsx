"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { DemoBanner } from "./DemoBanner";
import { TourOverlay, TOUR_STEPS } from "./TourOverlay";
import { LoginScreen } from "./LoginScreen";
import { useDemoStore, useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { bannerVisible, tourActive, tourStep } = useDemoStore();
  const user = useAuthStore((s) => s.user);

  // Show login screen if no user is logged in
  if (!user) {
    return <LoginScreen />;
  }

  const bannerOffset = bannerVisible ? 32 : 0;
  const highlightedNavId = tourActive ? TOUR_STEPS[tourStep].navId : null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <DemoBanner />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        bannerOffset={bannerOffset}
        highlightedNavId={highlightedNavId}
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
        <div className="p-6">{children}</div>
      </main>

      <MobileNav />
      <TourOverlay />
    </div>
  );
}
