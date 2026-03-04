"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { DemoBanner } from "./DemoBanner";
import { TourOverlay, TOUR_STEPS } from "./TourOverlay";
import { LoginScreen } from "./LoginScreen";
import { useDemoStore, useAuthStore, useCoachViewStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { bannerVisible, tourActive, tourStep } = useDemoStore();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const coachActive = useCoachViewStore((s) => s.active);
  const coachStoreName = useCoachViewStore((s) => s.storeName);
  const coachOwnerName = useCoachViewStore((s) => s.ownerName);
  const exitCoachView = useCoachViewStore((s) => s.exit);

  // Show login screen if no user is logged in
  if (!user) {
    return <LoginScreen />;
  }

  const bannerOffset = (coachActive || bannerVisible) ? 32 : 0;
  const highlightedNavId = tourActive ? TOUR_STEPS[tourStep].navId : null;

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
      ) : (
        <DemoBanner />
      )}
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
