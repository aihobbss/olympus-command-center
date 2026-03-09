import { create } from "zustand";
import {
  discoveryPool,
  initialSheetProducts,
  initialCopyProducts,
  type DiscoveryProduct,
  type SheetProduct,
  type ProductCopy,
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
// Manages the Research Sheet (product research tracking).

interface ResearchStore {
  // Discovery (kept for potential future use)
  discoveryResults: DiscoveryProduct[];
  runResearch: (count: number) => void;
  removeDiscovery: (id: string) => void;
  importToSheet: (id: string) => void;

  // Research Sheet
  sheetProducts: SheetProduct[];
  updateSheetProduct: (id: string, updates: Partial<SheetProduct>) => void;
  importAllUnimported: () => void;
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  discoveryResults: [],

  runResearch: (count) => {
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
      productType: "",
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

  importAllUnimported: () =>
    set((s) => ({
      sheetProducts: s.sheetProducts.map((p) =>
        !p.testingStatus ? { ...p, testingStatus: "Queued" as const } : p
      ),
    })),
}));

// ─── Product Copy Store ─────────────────────────────────
// Manages the Product Creation / Copy Generation sheet.

interface ProductCopyStore {
  copyProducts: ProductCopy[];
  updateCopyProduct: (id: string, updates: Partial<ProductCopy>) => void;
  generateCopy: (id: string) => void;
}

const MOCK_SHOPIFY = "Timeless Style Meets Modern Craft\n\nElevate your wardrobe with a versatile piece designed for everyday confidence. Premium materials and refined details make this a go-to for any occasion.\n\n\u2022 Quality Construction: Built to last with premium stitching\n\u2022 Modern Fit: Tailored silhouette flatters every frame\n\u2022 Versatile Design: Pairs effortlessly with any outfit\n\nDesigned for those who value style and substance.";

const MOCK_FACEBOOK = "Step Into Effortless Style\n\nPremium quality meets everyday wearability. This versatile piece was designed to elevate your look without trying too hard.\n\nClean. Confident. Versatile.\n\nFree Shipping\nShop now";

export const useProductCopyStore = create<ProductCopyStore>((set) => ({
  copyProducts: initialCopyProducts.map((p) => ({ ...p })),

  updateCopyProduct: (id, updates) =>
    set((s) => ({
      copyProducts: s.copyProducts.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  generateCopy: (id) => {
    // Set to Generating immediately
    set((s) => ({
      copyProducts: s.copyProducts.map((p) =>
        p.id === id ? { ...p, status: "Generating" as const } : p
      ),
    }));
    // Simulate generation after 2s
    setTimeout(() => {
      set((s) => ({
        copyProducts: s.copyProducts.map((p) =>
          p.id === id
            ? {
                ...p,
                status: "Completed" as const,
                shopifyDescription: p.shopifyDescription || MOCK_SHOPIFY,
                facebookCopy: p.facebookCopy || MOCK_FACEBOOK,
              }
            : p
        ),
      }));
    }, 2000);
  },
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

// ─── Coach View ──────────────────────────────────────────
// Set when a coach clicks "Enter This Store" from the
// Collaborators overlay. Persists globally so AppShell can
// render the mint green banner across all module pages.

interface CoachViewState {
  active: boolean;
  storeName: string;
  ownerName: string;
  enter: (storeName: string, ownerName: string) => void;
  exit: () => void;
}

export const useCoachViewStore = create<CoachViewState>((set) => ({
  active: false,
  storeName: "",
  ownerName: "",
  enter: (storeName, ownerName) => set({ active: true, storeName, ownerName }),
  exit: () => set({ active: false, storeName: "", ownerName: "" }),
}));
