import { create } from "zustand";
import {
  researchProducts,
  type ResearchProduct,
} from "@/data/mock";
import { mockStores, type MockStore } from "@/lib/navigation";

// ─── Product Store ───────────────────────────────────────
// Shared between Research and Import modules.
// Initialised from mock data; mutations persist across
// client-side navigations for the lifetime of the session.

interface ProductStore {
  products: ResearchProduct[];
  setProductStatus: (
    id: string,
    status: ResearchProduct["status"]
  ) => void;
}

export const useProductStore = create<ProductStore>((set) => ({
  products: researchProducts.map((p) => ({ ...p })),

  setProductStatus: (id, status) =>
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id ? { ...p, status } : p
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
