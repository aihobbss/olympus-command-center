import {
  Search,
  Package,
  PenTool,
  BarChart3,
  TrendingUp,
  Sparkles,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group?: "main" | "admin";
};

export const navItems: NavItem[] = [
  {
    id: "research",
    label: "Research",
    href: "/research",
    icon: Search,
    group: "main",
  },
  {
    id: "import",
    label: "Import",
    href: "/import",
    icon: Package,
    group: "main",
  },
  {
    id: "product-creation",
    label: "Product Creation",
    href: "/product-creation",
    icon: PenTool,
    group: "main",
  },
  {
    id: "ad-manager",
    label: "Ad Manager",
    href: "/ad-manager",
    icon: BarChart3,
    group: "main",
  },
  {
    id: "profit-tracker",
    label: "Profit Tracker",
    href: "/profit-tracker",
    icon: TrendingUp,
    group: "main",
  },
  {
    id: "creative-generator",
    label: "Creative Generator",
    href: "/creative-generator",
    icon: Sparkles,
    group: "main",
  },
];

// Phase 2/3 modules — kept for later implementation
export const deferredNavItems: NavItem[] = [
  {
    id: "customer-service",
    label: "Customer Service",
    href: "/customer-service",
    icon: MessageSquare,
    group: "main",
  },
  {
    id: "collaborators",
    label: "Collaborators",
    href: "/collaborators",
    icon: Users,
    group: "main",
  },
];

export type MockStore = {
  id: string;
  name: string;
  market: "UK" | "AU" | "USA";
  currency: string;
};

export const mockStores: MockStore[] = [
  { id: "vantage-london", name: "Vantage London", market: "UK", currency: "£" },
  { id: "vantage-melbourne", name: "Vantage Melbourne", market: "AU", currency: "A$" },
];
