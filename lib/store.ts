import { create } from "zustand";
import {
  discoveryPool,
  initialSheetProducts,
  initialCopyProducts,
  initialAdCreatorCampaigns,
  PROMPT_TEMPLATES,
  type DiscoveryProduct,
  type SheetProduct,
  type ProductCopy,
  type AdCreatorCampaign,
  type BatchQueueProduct,
  type ProductCreative,
  type PromptAllocation,
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
  addSheetProduct: () => void;
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
      discountPercent: 42,
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

  addSheetProduct: () =>
    set((s) => ({
      sheetProducts: [
        ...s.sheetProducts,
        {
          id: `sp-${Date.now()}`,
          productName: "",
          adLink: "",
          storeLink: "",
          testingStatus: "" as const,
          creativeSaved: false,
          cog: null,
          productType: "" as const,
          pricing: null,
          discountPercent: 42,
          notes: "",
        },
      ],
    })),
}));

// ─── Product Copy Store ─────────────────────────────────
// Manages the Product Creation / Copy Generation sheet.

interface ProductCopyStore {
  copyProducts: ProductCopy[];
  updateCopyProduct: (id: string, updates: Partial<ProductCopy>) => void;
  generateCopy: (id: string) => void;
  generateAll: () => void;
  pushToStore: (id: string) => void;
  pushAllToStore: () => void;
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

  generateAll: () => {
    const { copyProducts, generateCopy } = useProductCopyStore.getState();
    const pending = copyProducts.filter(
      (p) => p.status === "" || p.status === "Pending"
    );
    pending.forEach((p, i) => {
      setTimeout(() => generateCopy(p.id), i * 400);
    });
  },

  pushToStore: (id) => {
    set((s) => ({
      copyProducts: s.copyProducts.map((p) =>
        p.id === id ? { ...p, pushStatus: "pushing" as const } : p
      ),
    }));
    setTimeout(() => {
      set((s) => ({
        copyProducts: s.copyProducts.map((p) =>
          p.id === id ? { ...p, pushStatus: "pushed" as const } : p
        ),
      }));
    }, 1500);
  },

  pushAllToStore: () => {
    const { copyProducts, pushToStore } = useProductCopyStore.getState();
    const ready = copyProducts.filter(
      (p) => p.status === "Completed" && p.pushStatus === ""
    );
    ready.forEach((p, i) => {
      setTimeout(() => pushToStore(p.id), i * 300);
    });
  },
}));

// ─── Ad Creator Store ────────────────────────────────────
// Manages test campaign creation for Meta Ads.

interface AdCreatorStore {
  campaigns: AdCreatorCampaign[];
  updateCampaign: (id: string, updates: Partial<AdCreatorCampaign>) => void;
  addCampaign: () => void;
  removeCampaign: (id: string) => void;
  pushCampaign: (id: string) => void;
  pushAll: () => void;
}

export const useAdCreatorStore = create<AdCreatorStore>((set, get) => ({
  campaigns: initialAdCreatorCampaigns.map((c) => ({ ...c })),

  updateCampaign: (id, updates) =>
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  addCampaign: () =>
    set((s) => ({
      campaigns: [
        ...s.campaigns,
        {
          id: `ac-${Date.now()}`,
          productName: "",
          productUrl: "",
          primaryText: "",
          headline: "",
          description: "",
          cta: "Shop Now",
          country: "",
          budget: 30,
          gender: "" as const,
          creatives: [],
          status: "Queued" as const,
        },
      ],
    })),

  removeCampaign: (id) =>
    set((s) => ({
      campaigns: s.campaigns.filter((c) => c.id !== id),
    })),

  pushCampaign: (id) => {
    const campaign = get().campaigns.find((c) => c.id === id);
    if (!campaign || campaign.status !== "Ready") return;

    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id === id ? { ...c, status: "Pushing" as const } : c
      ),
    }));

    setTimeout(() => {
      set((s) => ({
        campaigns: s.campaigns.map((c) =>
          c.id === id ? { ...c, status: "Live" as const } : c
        ),
      }));
    }, 2000);
  },

  pushAll: () => {
    const { campaigns, pushCampaign } = get();
    const ready = campaigns.filter((c) => c.status === "Ready");
    ready.forEach((c, i) => {
      setTimeout(() => pushCampaign(c.id), i * 500);
    });
  },
}));

// ─── Creative Generator Store ────────────────────────────
// Manages batch queue and global product creatives pool.

const creativeGradients = [
  "from-indigo-600 to-purple-500",
  "from-emerald-600 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-600 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-violet-600 to-fuchsia-500",
];

interface CreativeGeneratorStore {
  batchQueue: BatchQueueProduct[];
  productCreatives: ProductCreative[];
  imagesPerProduct: number;
  promptAllocations: PromptAllocation[];

  setImagesPerProduct: (n: number) => void;
  setPromptAllocations: (allocs: PromptAllocation[]) => void;
  generateBatch: (productIds: string[]) => void;
  removeCreative: (creativeId: string) => void;
}

export const useCreativeGeneratorStore = create<CreativeGeneratorStore>(
  (set, get) => ({
    batchQueue: [],
    productCreatives: [],
    imagesPerProduct: 3,
    promptAllocations: [
      { templateId: PROMPT_TEMPLATES[10].id, label: PROMPT_TEMPLATES[10].label, count: 2 },
      { templateId: PROMPT_TEMPLATES[2].id, label: PROMPT_TEMPLATES[2].label, count: 1 },
    ],

    setImagesPerProduct: (n) => set({ imagesPerProduct: n }),
    setPromptAllocations: (allocs) => set({ promptAllocations: allocs }),

    generateBatch: (productIds) => {
      const { batchQueue, promptAllocations } = get();
      const products = batchQueue.filter((p) => productIds.includes(p.id));
      const newCreatives: ProductCreative[] = [];
      let idx = 0;

      for (const product of products) {
        for (const alloc of promptAllocations) {
          for (let i = 0; i < alloc.count; i++) {
            newCreatives.push({
              id: `pcr-${Date.now()}-${idx}`,
              productName: product.productName,
              productCopyId: product.productCopyId,
              concept: alloc.label,
              placeholderGradient: creativeGradients[idx % creativeGradients.length],
              status: "pending",
            });
            idx++;
          }
        }
      }

      // Set all selected products to generating
      set((s) => ({
        batchQueue: s.batchQueue.map((p) =>
          productIds.includes(p.id) ? { ...p, status: "generating" as const } : p
        ),
        productCreatives: [...s.productCreatives, ...newCreatives],
      }));

      // Stagger-reveal creatives
      newCreatives.forEach((c, i) => {
        setTimeout(() => {
          set((s) => ({
            productCreatives: s.productCreatives.map((pc) =>
              pc.id === c.id ? { ...pc, status: "completed" as const } : pc
            ),
          }));
        }, (i + 1) * 200);
      });

      // Mark products completed after all creatives done
      const totalTime = (newCreatives.length + 1) * 200;
      setTimeout(() => {
        set((s) => ({
          batchQueue: s.batchQueue.map((p) =>
            productIds.includes(p.id) ? { ...p, status: "completed" as const } : p
          ),
        }));
      }, totalTime);
    },

    removeCreative: (creativeId) =>
      set((s) => ({
        productCreatives: s.productCreatives.filter((c) => c.id !== creativeId),
      })),
  })
);

// ─── Cross-store subscription: ProductCopy → Creative Generator batch queue ──
useProductCopyStore.subscribe((state) => {
  const pushed = state.copyProducts.filter((p) => p.pushStatus === "pushed");
  const currentQueue = useCreativeGeneratorStore.getState().batchQueue;
  const existingIds = new Set(currentQueue.map((q) => q.productCopyId));
  const newProducts = pushed.filter((p) => !existingIds.has(p.id));

  if (newProducts.length > 0) {
    useCreativeGeneratorStore.setState((s) => ({
      batchQueue: [
        ...s.batchQueue,
        ...newProducts.map((p) => ({
          id: `bq-${Date.now()}-${p.id}`,
          productCopyId: p.id,
          productName: p.productName,
          productUrl: p.productUrl,
          imageUrl: p.imageUrl,
          status: "queued" as const,
        })),
      ],
    }));
  }
});

// ─── Cross-store subscription: Creatives → Ad Creator auto-attach ──
useCreativeGeneratorStore.subscribe((state) => {
  const completed = state.productCreatives.filter((c) => c.status === "completed");
  if (completed.length === 0) return;

  const adStore = useAdCreatorStore.getState();

  for (const creative of completed) {
    const campaign = adStore.campaigns.find(
      (c) => c.productName === creative.productName
    );
    if (!campaign) continue;

    const alreadyAttached = campaign.creatives.some((c) => c.id === creative.id);
    if (alreadyAttached) continue;

    adStore.updateCampaign(campaign.id, {
      creatives: [
        ...campaign.creatives,
        {
          id: creative.id,
          concept: creative.concept,
          placeholderGradient: creative.placeholderGradient,
        },
      ],
    });
  }
});

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
