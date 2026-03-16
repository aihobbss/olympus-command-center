"use client";

import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Use a CSS animation instead of Framer Motion to avoid animation state
  // issues that can prevent pages from mounting during rapid navigation
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
