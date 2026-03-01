import { create } from "zustand";
import {
  discoveryPool,
  initialSheetProducts,
  type DiscoveryProduct,
  type SheetProduct,
} from "@/data/mock";
import { mockStores, type MockStore } from "@/lib/navigation";

// ─── Auth Store ──────────────────────────────────────────
// Mock user profiles for the demo login screen.

export type UserRole = "owner" | "coach";

export type MockUser = {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  storeIds: string[];       // which stores this user can access
  avatarGradient: string;   // tailwind gradient classes
};

export const mockUsers: MockUser[] = [
  {
    id: "simo",
    name: "Simo",
    initials: "S",
    role: "coach",
    storeIds: ["olympus-london", "vantage-melbourne"],
    avatarGradient: "from-accent-indigo to-accent-indigo/40",
  },
  {
    id: "jake",
    name: "Jake",
    initials: "J",
    role: "owner",
    storeIds: ["vantage-melbourne"],
    avatarGradient: "from-accent-emerald to-accent-emerald/40",
  },
];

interface AuthStore {
  user: MockUser | null;
  login: (user: MockUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));

// ─── Research Store ──────────────────────────────────────
// Manages both the Discovery tab (run research, review cards)
// and the Research Sheet tab (imported products tracking).

interface ResearchStore {
  // Discovery tab
  discoveryResults: DiscoveryProduct[];
  runResearch: (count: number) => void;
  removeDiscovery: (id: string) => void;
  importToSheet: (id: string) => void;

  // Research Sheet tab
  sheetProducts: SheetProduct[];
  updateSheetProduct: (id: string, updates: Partial<SheetProduct>) => void;
  queueForImport: (id: string) => void;
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  discoveryResults: [],

  runResearch: (count) => {
    // Shuffle the pool and pick `count` items, excluding any already on the sheet
    const sheetNames = new Set(get().sheetProducts.map((p) => p.productName));
    const available = discoveryPool.filter((p) => !sheetNames.has(p.productName));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    set({ discoveryResults: shuffled.slice(0, Math.min(count, shuffled.length)) });
  },

  removeDiscovery: (id) =>
    set((s) => ({
      discoveryResults: s.discoveryResults.filter((p) => p.id !== id),
    })),

  importToSheet: (id) => {
    const product = get().discoveryResults.find((p) => p.id === id);
    if (!product) return;
    const newSheet: SheetProduct = {
      id: `sp-${Date.now()}`,
      productName: product.productName,
      adLink: product.adLink,
      storeLink: "",
      testingStatus: "",
      creativeSaved: false,
      cog: null,
      pricing: null,
      notes: "",
    };
    set((s) => ({
      discoveryResults: s.discoveryResults.filter((p) => p.id !== id),
      sheetProducts: [...s.sheetProducts, newSheet],
    }));
  },

  sheetProducts: initialSheetProducts.map((p) => ({ ...p })),

  updateSheetProduct: (id, updates) =>
    set((s) => ({
      sheetProducts: s.sheetProducts.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  queueForImport: (id) =>
    set((s) => ({
      sheetProducts: s.sheetProducts.map((p) =>
        p.id === id ? { ...p, testingStatus: "Queued" as const } : p
      ),
    })),
}));

// ─── Store Context ──────────────────────────────────────
// Global store selector state so that the chosen store
// propagates across every module without prop-drilling.

interface StoreContext {
  selectedStore: MockStore;
  setSelectedStore: (store: MockStore) => void;
}

export const useStoreContext = create<StoreContext>((set) => ({
  selectedStore: mockStores[0],
  setSelectedStore: (store) => set({ selectedStore: store }),
}));

// ─── Demo Mode ──────────────────────────────────────────
// Controls the demo banner visibility and guided tour state.

interface DemoStore {
  bannerVisible: boolean;
  dismissBanner: () => void;
  tourActive: boolean;
  tourStep: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
}

export const useDemoStore = create<DemoStore>((set) => ({
  bannerVisible: true,
  dismissBanner: () => set({ bannerVisible: false }),
  tourActive: false,
  tourStep: 0,
  startTour: () => set({ tourActive: true, tourStep: 0 }),
  nextStep: () =>
    set((state) => ({ tourStep: Math.min(state.tourStep + 1, 7) })),
  prevStep: () =>
    set((state) => ({ tourStep: Math.max(state.tourStep - 1, 0) })),
  endTour: () => set({ tourActive: false, tourStep: 0 }),
}));
