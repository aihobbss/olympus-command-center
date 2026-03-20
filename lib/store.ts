import { create } from "zustand";
import {
  PROMPT_TEMPLATES,
  type SheetProduct,
  type ProductCopy,
  type AdCreatorCampaign,
  type BatchQueueProduct,
  type ProductCreative,
  type PromptAllocation,
} from "@/data/mock";
import { supabase, authFetch } from "@/lib/supabase";

// ─── Auth Store ──────────────────────────────────────────
// Supabase-backed auth with approval gate.

export type UserRole = "owner" | "admin" | "member";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: UserRole;
  approved: boolean;
  storeIds: string[];
  avatarGradient: string;
};

// Backward compat alias (other files may reference MockUser)
export type MockUser = AppUser;
export const mockUsers: AppUser[] = [];

const AVATAR_GRADIENTS = [
  "from-accent-indigo to-accent-indigo/40",
  "from-accent-emerald to-accent-emerald/40",
  "from-accent-amber to-accent-amber/40",
  "from-rose-500 to-rose-500/40",
  "from-cyan-500 to-cyan-500/40",
  "from-violet-500 to-violet-500/40",
];

function pickGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

async function buildAppUser(userId: string, email: string): Promise<AppUser> {
  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, approved, active_store_id")
    .eq("id", userId)
    .single();

  // Fetch user's store IDs
  const { data: userStores } = await supabase
    .from("user_stores")
    .select("store_id")
    .eq("user_id", userId);

  const name = profile?.full_name || email.split("@")[0];
  const storeIds = userStores?.map((us) => us.store_id) ?? [];

  return {
    id: userId,
    email,
    name,
    initials: getInitials(name),
    role: (profile?.role as UserRole) ?? "owner",
    approved: profile?.approved ?? false,
    storeIds,
    avatarGradient: pickGradient(userId),
  };
}

interface AuthStore {
  user: AppUser | null;
  loading: boolean;
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;

  // Backward compat
  login: (user: AppUser) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    // Unsubscribe any previous auth listener to prevent memory leaks
    const prev = (useAuthStore as unknown as Record<string, unknown>)._authSubscription as
      | { unsubscribe: () => void }
      | undefined;
    prev?.unsubscribe();

    try {
      // Check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const appUser = await buildAppUser(session.user.id, session.user.email!);
        set({ user: appUser, loading: false, initialized: true });
      } else {
        set({ user: null, loading: false, initialized: true });
      }
    } catch (err) {
      console.error("Auth initialization failed:", err);
      set({ user: null, loading: false, initialized: true });
    }

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const appUser = await buildAppUser(session.user.id, session.user.email!);
        set({ user: appUser, loading: false });
      } else if (event === "SIGNED_OUT") {
        set({ user: null, loading: false });
      }
    });

    // Store subscription for cleanup on re-initialization
    (useAuthStore as unknown as Record<string, unknown>)._authSubscription = subscription;
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message };
      }
      // onAuthStateChange will handle setting the user and clearing loading
      return {};
    } catch {
      return { error: "An unexpected error occurred" };
    } finally {
      set({ loading: false });
    }
  },

  signUpWithEmail: async (email, password, fullName) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        return { error: error.message };
      }
      // Update profile with full name if signup succeeded
      if (data.user) {
        await supabase
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", data.user.id);
      }
      return {};
    } catch {
      return { error: "An unexpected error occurred" };
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

  // Backward compat — direct set (used nowhere in prod, kept for type safety)
  login: (user) => set({ user }),
}));

// ─── Products Store ──────────────────────────────────────
// Manages the unified product entity (formerly Research Sheet).
// Persisted to Supabase via lib/services/products.ts.
// Products flow: Research → Import → Product Creation → Creative → Ad → Profit.

import {
  fetchProducts as fetchResearchProducts,
  createProduct as createResearchProduct,
  updateProduct as updateResearchProductDB,
  bulkUpdateStatus,
} from "@/lib/services/products";

// Debounce map for batching rapid edits before writing to DB
type PendingWrite = { timer: ReturnType<typeof setTimeout>; flush: () => void };
const updateTimers: Record<string, PendingWrite> = {};

// AbortController for in-flight research product loads — cancels stale fetches on rapid navigation
let _researchLoadController: AbortController | null = null;

interface ResearchStore {
  // Research Sheet
  sheetProducts: SheetProduct[];
  loading: boolean;
  adding: boolean;
  error: string | null;
  loadProducts: (storeId: string) => Promise<void>;
  updateSheetProduct: (id: string, updates: Partial<SheetProduct>) => void;
  importAllUnimported: () => void;
  addSheetProduct: () => void;
  deleteSheetProduct: (id: string) => void;
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  sheetProducts: [],
  loading: false,
  adding: false,
  error: null,

  loadProducts: async (storeId) => {
    // Abort any in-flight load to free the browser connection
    _researchLoadController?.abort();
    const controller = new AbortController();
    _researchLoadController = controller;

    // Only show loading spinner if we have no cached data yet
    const hasData = get().sheetProducts.length > 0;
    if (!hasData) {
      set({ loading: true });
    }
    set({ error: null });
    try {
      const products = await fetchResearchProducts(storeId, controller.signal);
      if (controller.signal.aborted) return; // stale — newer load in progress
      set({ sheetProducts: products, loading: false, error: null });
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // cancelled, not an error
      if (!controller.signal.aborted) {
        set({ loading: false, error: "Failed to load products. Please try again." });
      }
    }
  },

  updateSheetProduct: (id, updates) => {
    // Optimistic local update
    set((s) => ({
      sheetProducts: s.sheetProducts.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));

    // Debounced DB write (300ms) — batches rapid edits, flushable on store switch
    if (updateTimers[id]) clearTimeout(updateTimers[id].timer);
    const store = useStoreContext.getState().selectedStore;
    const flush = () => {
      if (store) updateResearchProductDB(id, updates, store.id);
      delete updateTimers[id];
    };
    updateTimers[id] = {
      timer: setTimeout(flush, 300),
      flush,
    };

    // Cross-store name propagation: when productName changes, update all downstream modules
    if (updates.productName) {
      const newName = updates.productName;

      // Update ProductCopy store — match by productId
      useProductCopyStore.setState((s) => ({
        copyProducts: s.copyProducts.map((p) =>
          p.productId === id ? { ...p, productName: newName } : p
        ),
      }));

      // Update CreativeGenerator batch queue — match by productId
      useCreativeGeneratorStore.setState((s) => ({
        batchQueue: s.batchQueue.map((p) =>
          p.productId === id ? { ...p, productName: newName } : p
        ),
      }));

      // Update CreativeGenerator product creatives — match by productId
      useCreativeGeneratorStore.setState((s) => ({
        productCreatives: s.productCreatives.map((p) =>
          p.productId === id ? { ...p, productName: newName } : p
        ),
      }));

      // Update AdCreator campaigns — match by productId
      useAdCreatorStore.setState((s) => ({
        campaigns: s.campaigns.map((c) =>
          c.productId === id ? { ...c, productName: newName } : c
        ),
      }));
    }
  },

  importAllUnimported: () => {
    const unimported = get().sheetProducts.filter((p) => !p.testingStatus);
    if (unimported.length === 0) return;

    // Optimistic update
    set((s) => ({
      sheetProducts: s.sheetProducts.map((p) =>
        !p.testingStatus ? { ...p, testingStatus: "Queued" as const } : p
      ),
    }));

    // Persist to DB
    const store = useStoreContext.getState().selectedStore;
    const ids = unimported.map((p) => p.id);
    bulkUpdateStatus(ids, "Queued", store?.id);
  },

  addSheetProduct: async () => {
    if (get().adding) return;
    const store = useStoreContext.getState().selectedStore;
    if (!store) return;

    set({ adding: true });
    try {
      const product = await createResearchProduct(store.id);
      if (product) {
        set((s) => ({
          sheetProducts: [...s.sheetProducts, product],
        }));
      }
    } finally {
      set({ adding: false });
    }
  },

  deleteSheetProduct: (id) => {
    const store = useStoreContext.getState().selectedStore;
    set((s) => ({
      sheetProducts: s.sheetProducts.filter((p) => p.id !== id),
    }));
    // Fire-and-forget DB delete
    import("@/lib/services/products").then((m) => m.deleteProduct(id, store?.id));
  },
}));

// Export alias: useProductsStore is the canonical name for the product entity store
export const useProductsStore = useResearchStore;

// ─── Product Copy Store ─────────────────────────────────
// Manages the Product Creation / Copy Generation sheet.
// Loads from Supabase, debounced writes on edits.

interface ProductCopyStore {
  copyProducts: ProductCopy[];
  loading: boolean;
  error: string | null;
  loadProducts: (storeId: string) => Promise<void>;
  updateCopyProduct: (id: string, updates: Partial<ProductCopy>) => void;
  deleteCopyProduct: (id: string) => void;
  generateCopy: (id: string) => Promise<void>;
  generateAll: () => void;
  pushToStore: (id: string) => Promise<void>;
  pushAllToStore: () => void;
  generateSizeChart: (id: string) => Promise<void>;
}

// Debounce timers for product copy updates
const copyUpdateTimers: Record<string, PendingWrite> = {};

// AbortController for in-flight product copy loads
let _copyLoadController: AbortController | null = null;

async function updateProductCopyDB(id: string, updates: Partial<ProductCopy>, storeId: string) {
  const { updateProductCopy } = await import("@/lib/services/product-copy");
  await updateProductCopy(id, updates, storeId);
}

export const useProductCopyStore = create<ProductCopyStore>((set, get) => ({
  copyProducts: [],
  loading: false,
  error: null,

  loadProducts: async (storeId: string) => {
    // Abort any in-flight load to free the browser connection
    _copyLoadController?.abort();
    const controller = new AbortController();
    _copyLoadController = controller;

    // Only show loading spinner if we have no cached data yet
    const hasData = get().copyProducts.length > 0;
    if (!hasData) {
      set({ loading: true });
    }
    set({ error: null });
    try {
      const { fetchProductCopies } = await import("@/lib/services/product-copy");
      const products = await fetchProductCopies(storeId, controller.signal);
      if (controller.signal.aborted) return;
      set({ copyProducts: products, loading: false, error: null });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (!controller.signal.aborted) {
        set({ loading: false, error: "Failed to load product copies. Please try again." });
      }
    }
  },

  updateCopyProduct: (id, updates) => {
    // If any content field changes on a pushed product, reset pushStatus so it can be re-pushed
    const contentFields = ["productName", "shopifyDescription", "facebookCopy", "productUrl", "sizeChartTable"];
    const current = get().copyProducts.find((p) => p.id === id);
    if (current?.pushStatus === "pushed" && contentFields.some((f) => f in updates)) {
      updates = { ...updates, pushStatus: "" as const };
    }

    // Optimistic update
    set((s) => ({
      copyProducts: s.copyProducts.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));

    // Debounced DB write — flushable on store switch
    const store = useStoreContext.getState().selectedStore;
    if (store) {
      if (copyUpdateTimers[id]) clearTimeout(copyUpdateTimers[id].timer);
      const flush = () => {
        updateProductCopyDB(id, updates, store.id);
        delete copyUpdateTimers[id];
      };
      copyUpdateTimers[id] = { timer: setTimeout(flush, 300), flush };
    }

    // Reverse name propagation: when productName changes on a copy product with a productId,
    // propagate back to the Research/Products entity store
    if (updates.productName && current?.productId) {
      useProductsStore.getState().updateSheetProduct(current.productId, { productName: updates.productName });
    }
  },

  deleteCopyProduct: (id) => {
    const store = useStoreContext.getState().selectedStore;
    set((s) => ({
      copyProducts: s.copyProducts.filter((p) => p.id !== id),
    }));
    // Fire-and-forget DB delete
    import("@/lib/services/product-copy").then((m) => m.deleteProductCopy(id, store?.id));
  },

  generateCopy: async (id) => {
    // Guard: skip if already generating
    const current = get().copyProducts.find((p) => p.id === id);
    if (current?.status === "Generating") return;

    const store = useStoreContext.getState().selectedStore;
    // Set to Generating immediately
    set((s) => ({
      copyProducts: s.copyProducts.map((p) =>
        p.id === id ? { ...p, status: "Generating" as const } : p
      ),
    }));
    if (store) updateProductCopyDB(id, { status: "Generating" }, store.id);

    const product = get().copyProducts.find((p) => p.id === id);

    try {
      const res = await authFetch("/api/generate-copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productName: product?.productName || "Product",
          productUrl: product?.productUrl || "",
          imageUrl: product?.imageUrl || "",
          market: store?.market || "AU",
          currency: store?.currency || "AUD",
          storeName: store?.name || "",
          storeId: store?.id,
          productCopyId: id, // API uses this to look up research product pricing
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updates: Partial<ProductCopy> = {
          status: "Completed" as const,
          shopifyDescription: data.shopifyDescription || "",
          facebookCopy: data.facebookCopy || "",
          // Update product name if Claude cleaned it
          ...(data.cleanedTitle && data.cleanedTitle !== product?.productName
            ? { productName: data.cleanedTitle }
            : {}),
        };
        set((s) => ({
          copyProducts: s.copyProducts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
        if (store) updateProductCopyDB(id, updates, store.id);

        // Auto-generate size chart if image is attached and not yet generated
        const latest = get().copyProducts.find((p) => p.id === id);
        if (latest?.sizeChartImage && latest.sizeChartStatus !== "done" && latest.sizeChartStatus !== "generating") {
          get().generateSizeChart(id);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Copy generation failed:", err.message || res.statusText);
        const updates: Partial<ProductCopy> = { status: "Error" as const };
        set((s) => ({
          copyProducts: s.copyProducts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
        if (store) updateProductCopyDB(id, updates, store.id);
      }
    } catch (error) {
      console.error("Copy generation error:", error);
      const updates: Partial<ProductCopy> = { status: "Error" as const };
      set((s) => ({
        copyProducts: s.copyProducts.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }));
      if (store) updateProductCopyDB(id, updates, store.id);
    }
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

  pushToStore: async (id) => {
    // Guard: skip if already pushing or pushed
    const current = get().copyProducts.find((p) => p.id === id);
    if (current?.pushStatus === "pushing" || current?.pushStatus === "pushed") return;

    const store = useStoreContext.getState().selectedStore;
    const user = useAuthStore.getState().user;
    set((s) => ({
      copyProducts: s.copyProducts.map((p) =>
        p.id === id ? { ...p, pushStatus: "pushing" as const } : p
      ),
    }));
    if (store) updateProductCopyDB(id, { pushStatus: "pushing" }, store.id);

    const product = get().copyProducts.find((p) => p.id === id);

    try {
      const res = await authFetch("/api/push-to-shopify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productName: product?.productName || "Product",
          shopifyDescription: product?.shopifyDescription || "",
          sizeChartTable: product?.sizeChartTable || "",
          productUrl: product?.productUrl || "",
          imageUrl: product?.imageUrl || "",
          userId: user?.id,
          storeId: store?.id,
          productCopyId: id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updates: Partial<ProductCopy> = {
          pushStatus: "pushed" as const,
          shopifyProductId: data.shopifyProductId || undefined,
        };
        set((s) => ({
          copyProducts: s.copyProducts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
        if (store) updateProductCopyDB(id, updates, store.id);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Shopify push failed:", err.message || res.statusText);
        const updates: Partial<ProductCopy> = { pushStatus: "error" as const };
        set((s) => ({
          copyProducts: s.copyProducts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
        if (store) updateProductCopyDB(id, updates, store.id);
      }
    } catch (error) {
      console.error("Shopify push error:", error);
      const updates: Partial<ProductCopy> = { pushStatus: "error" as const };
      set((s) => ({
        copyProducts: s.copyProducts.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }));
      if (store) updateProductCopyDB(id, updates, store.id);
    }
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

  generateSizeChart: async (id) => {
    // Guard: skip if already generating
    const current = get().copyProducts.find((p) => p.id === id);
    if (current?.sizeChartStatus === "generating") return;

    const store = useStoreContext.getState().selectedStore;
    set((s) => ({
      copyProducts: s.copyProducts.map((p) =>
        p.id === id ? { ...p, sizeChartStatus: "generating" as const } : p
      ),
    }));
    if (store) updateProductCopyDB(id, { sizeChartStatus: "generating" }, store.id);

    const product = get().copyProducts.find((p) => p.id === id);

    try {
      const res = await authFetch("/api/generate-size-chart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageUrl: product?.sizeChartImage || "",
          storeId: store?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Reset pushStatus so product can be re-pushed with the new size chart
        const wasPushed = get().copyProducts.find((p) => p.id === id)?.pushStatus === "pushed";
        const updates: Partial<ProductCopy> = {
          sizeChartStatus: "done" as const,
          sizeChartTable: data.sizeChartTable || "",
          ...(wasPushed ? { pushStatus: "" as const } : {}),
        };
        set((s) => ({
          copyProducts: s.copyProducts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
        if (store) updateProductCopyDB(id, updates, store.id);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Size chart generation failed:", err.message || res.statusText);
        const updates: Partial<ProductCopy> = { sizeChartStatus: "error" as const };
        set((s) => ({
          copyProducts: s.copyProducts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
        if (store) updateProductCopyDB(id, updates, store.id);
      }
    } catch (error) {
      console.error("Size chart generation error:", error);
      const updates: Partial<ProductCopy> = { sizeChartStatus: "error" as const };
      set((s) => ({
        copyProducts: s.copyProducts.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }));
      if (store) updateProductCopyDB(id, updates, store.id);
    }
  },
}));

// ─── Ad Creator Store ────────────────────────────────────
// Manages test campaign creation for Meta Ads.
// Loads from Supabase, debounced writes on edits.

interface AdCreatorStore {
  campaigns: AdCreatorCampaign[];
  loading: boolean;
  error: string | null;
  loadCampaigns: (storeId: string) => Promise<void>;
  updateCampaign: (id: string, updates: Partial<AdCreatorCampaign>) => void;
  addCampaign: () => void;
  removeCampaign: (id: string) => void;
  pushCampaign: (id: string, adAccountId?: string) => void;
  pushAll: (adAccountId?: string) => void;
}

// Debounce timers for ad creator updates
const adCreatorUpdateTimers: Record<string, PendingWrite> = {};

// AbortController for in-flight ad creator campaign loads
let _adCreatorLoadController: AbortController | null = null;

async function updateAdCreatorDB(id: string, updates: Partial<AdCreatorCampaign>, storeId: string) {
  const { updateAdCreatorCampaign } = await import("@/lib/services/ad-creator");
  await updateAdCreatorCampaign(id, updates, storeId);
}

export const useAdCreatorStore = create<AdCreatorStore>((set, get) => ({
  campaigns: [],
  loading: false,
  error: null,

  loadCampaigns: async (storeId: string) => {
    // Abort any in-flight load to free the browser connection
    _adCreatorLoadController?.abort();
    const controller = new AbortController();
    _adCreatorLoadController = controller;

    const hasData = get().campaigns.length > 0;
    if (!hasData) {
      set({ loading: true });
    }
    set({ error: null });
    try {
      const { fetchAdCreatorCampaigns } = await import("@/lib/services/ad-creator");
      const campaigns = await fetchAdCreatorCampaigns(storeId, controller.signal);
      if (controller.signal.aborted) return;
      set({ campaigns, loading: false, error: null });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Failed to load ad creator campaigns:", err);
      if (!controller.signal.aborted) {
        set({ campaigns: [], loading: false, error: "Failed to load campaigns. Please try again." });
      }
    }
  },

  updateCampaign: (id, updates) => {
    // Optimistic update
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));

    // Debounced DB write — flushable on store switch
    const store = useStoreContext.getState().selectedStore;
    if (store) {
      if (adCreatorUpdateTimers[id]) clearTimeout(adCreatorUpdateTimers[id].timer);
      const flush = () => {
        updateAdCreatorDB(id, updates, store.id);
        delete adCreatorUpdateTimers[id];
      };
      adCreatorUpdateTimers[id] = { timer: setTimeout(flush, 300), flush };
    }
  },

  addCampaign: async () => {
    const store = useStoreContext.getState().selectedStore;
    if (!store) return;

    try {
      const { createAdCreatorCampaign } = await import("@/lib/services/ad-creator");
      const campaign = await createAdCreatorCampaign(store.id);
      if (campaign) {
        set((s) => ({ campaigns: [...s.campaigns, campaign] }));
      }
    } catch (err) {
      console.error("Failed to add campaign:", err);
    }
  },

  removeCampaign: (id) => {
    const store = useStoreContext.getState().selectedStore;
    set((s) => ({
      campaigns: s.campaigns.filter((c) => c.id !== id),
    }));
    import("@/lib/services/ad-creator").then((m) => m.deleteAdCreatorCampaign(id, store?.id));
  },

  pushCampaign: async (id, adAccountId) => {
    const campaign = get().campaigns.find((c) => c.id === id);
    if (!campaign || campaign.status !== "Ready") return;
    const store = useStoreContext.getState().selectedStore;
    const user = useAuthStore.getState().user;

    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id === id ? { ...c, status: "Pushing" as const } : c
      ),
    }));
    if (store) updateAdCreatorDB(id, { status: "Pushing" }, store.id);

    try {
      const res = await authFetch("/api/push-to-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, campaignId: id, adAccountId }),
      });

      if (res.ok) {
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === id ? { ...c, status: "Live" as const } : c
          ),
        }));
        // Persist "Live" status to DB so it survives page refresh
        if (store) updateAdCreatorDB(id, { status: "Live" }, store.id);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Push to Meta failed:", err.error);
        // Revert to Ready on failure
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === id ? { ...c, status: "Ready" as const } : c
          ),
        }));
        if (store) updateAdCreatorDB(id, { status: "Ready" }, store.id);
      }
    } catch (err) {
      console.error("Push to Meta error:", err);
      set((s) => ({
        campaigns: s.campaigns.map((c) =>
          c.id === id ? { ...c, status: "Ready" as const } : c
        ),
      }));
      if (store) updateAdCreatorDB(id, { status: "Ready" }, store.id);
    }
  },

  pushAll: (adAccountId) => {
    const { campaigns, pushCampaign } = get();
    const ready = campaigns.filter((c) => c.status === "Ready");
    ready.forEach((c, i) => {
      setTimeout(() => pushCampaign(c.id, adAccountId), i * 500);
    });
  },
}));

// ─── Creative Generator Store ────────────────────────────
// Manages batch queue and global product creatives pool.

// Track active creative generation timers so they can be cancelled on store switch
const _creativeTimers: ReturnType<typeof setTimeout>[] = [];

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
  loaded: boolean;

  loadBatchQueue: (storeId: string) => Promise<void>;
  loadCreatives: (storeId: string) => Promise<void>;
  setImagesPerProduct: (n: number) => void;
  setPromptAllocations: (allocs: PromptAllocation[]) => void;
  generateBatch: (productIds: string[]) => void;
  removeCreative: (creativeId: string) => void;
  saveCreative: (creativeId: string) => Promise<void>;
}

import {
  fetchBatchQueue,
  fetchCreatives as fetchCreativesFromDb,
  updateCreativeStatus,
  deleteCreative as deleteCreativeFromDb,
} from "@/lib/services/creative-generator";

export const useCreativeGeneratorStore = create<CreativeGeneratorStore>(
  (set, get) => ({
    batchQueue: [],
    productCreatives: [],
    imagesPerProduct: 3,
    promptAllocations: [
      { templateId: PROMPT_TEMPLATES[10].id, label: PROMPT_TEMPLATES[10].label, count: 2 },
      { templateId: PROMPT_TEMPLATES[2].id, label: PROMPT_TEMPLATES[2].label, count: 1 },
    ],
    loaded: false,

    loadBatchQueue: async (storeId: string) => {
      try {
        const queue = await fetchBatchQueue(storeId);
        set({ batchQueue: queue });
      } catch (err) {
        console.error("Failed to load batch queue:", err);
      }
    },

    loadCreatives: async (storeId: string) => {
      try {
        const creatives = await fetchCreativesFromDb(storeId);
        set({ productCreatives: creatives, loaded: true });
      } catch (err) {
        console.error("Failed to load creatives:", err);
        set({ loaded: true });
      }
    },

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
              productId: product.productId,
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

      // Cancel any in-flight creative timers from a previous batch
      while (_creativeTimers.length) clearTimeout(_creativeTimers.pop());

      // Stagger-reveal creatives (placeholder until Nanobanana API is wired)
      newCreatives.forEach((c, i) => {
        const t = setTimeout(() => {
          set((s) => ({
            productCreatives: s.productCreatives.map((pc) =>
              pc.id === c.id ? { ...pc, status: "completed" as const } : pc
            ),
          }));
        }, (i + 1) * 200);
        _creativeTimers.push(t);
      });

      // Mark products completed after all creatives done
      const totalTime = (newCreatives.length + 1) * 200;
      const finalTimer = setTimeout(() => {
        set((s) => ({
          batchQueue: s.batchQueue.map((p) =>
            productIds.includes(p.id) ? { ...p, status: "completed" as const } : p
          ),
        }));
      }, totalTime);
      _creativeTimers.push(finalTimer);
    },

    removeCreative: async (creativeId) => {
      const store = useStoreContext.getState().selectedStore;
      set((s) => ({
        productCreatives: s.productCreatives.filter((c) => c.id !== creativeId),
      }));
      // Delete from DB if it's a real UUID (not a temp pcr- id)
      if (!creativeId.startsWith("pcr-")) {
        await deleteCreativeFromDb(creativeId, store?.id);
      }
    },

    saveCreative: async (creativeId: string) => {
      // Mark as saved locally
      set((s) => ({
        productCreatives: s.productCreatives.map((c) =>
          c.id === creativeId ? { ...c, status: "completed" as const } : c
        ),
      }));
      // Persist to DB if it's a real UUID
      if (!creativeId.startsWith("pcr-")) {
        await updateCreativeStatus(creativeId, "saved");
      }
    },
  })
);

// ─── Cross-store subscription: ProductCopy → Creative Generator batch queue ──
// Uses productId for matching (falls back to productCopyId for legacy data).
// Guarded by selectedStore to prevent cross-store data leakage.
useProductCopyStore.subscribe((state) => {
  const selectedStore = useStoreContext.getState().selectedStore;
  if (!selectedStore) return;

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
          productId: p.productId,
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
// Uses productId for matching (falls back to productName for legacy data).
// Guarded by selectedStore to prevent cross-store data leakage.
useCreativeGeneratorStore.subscribe((state) => {
  const selectedStore = useStoreContext.getState().selectedStore;
  if (!selectedStore) return;

  const completed = state.productCreatives.filter((c) => c.status === "completed");
  if (completed.length === 0) return;

  const adStore = useAdCreatorStore.getState();

  for (const creative of completed) {
    // Match by productId first, fallback to productName
    const campaign = creative.productId
      ? adStore.campaigns.find((c) => c.productId === creative.productId)
      : adStore.campaigns.find((c) => c.productName === creative.productName);
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

export type AppStore = {
  id: string;
  name: string;
  market: string;
  currency: string;
  shopifyDomain?: string;
  customDomain?: string;
};

interface StoreContext {
  stores: AppStore[];
  selectedStore: AppStore | null;
  setSelectedStore: (store: AppStore) => void;
  loadStores: () => Promise<void>;
}

export const useStoreContext = create<StoreContext>((set) => ({
  stores: [],
  selectedStore: null,
  loadStores: async () => {
    const user = useAuthStore.getState().user;
    if (!user || user.storeIds.length === 0) {
      set({ stores: [], selectedStore: null });
      return;
    }
    try {
      const { data } = await supabase
        .from("stores")
        .select("id, name, market, currency, shopify_domain, custom_domain")
        .in("id", user.storeIds);
      const stores: AppStore[] = (data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        market: s.market,
        currency: s.currency,
        shopifyDomain: s.shopify_domain || undefined,
        customDomain: s.custom_domain || undefined,
      }));
      set((prev) => ({
        stores,
        selectedStore: prev.selectedStore && stores.find((s) => s.id === prev.selectedStore!.id)
          ? prev.selectedStore
          : stores[0] ?? null,
      }));
    } catch (err) {
      console.error("Failed to load stores:", err);
    }
  },
  setSelectedStore: (store) => {
    // Flush all pending debounce writes to the OLD store before switching
    for (const key of Object.keys(updateTimers)) {
      clearTimeout(updateTimers[key].timer);
      updateTimers[key].flush();
    }
    for (const key of Object.keys(copyUpdateTimers)) {
      clearTimeout(copyUpdateTimers[key].timer);
      copyUpdateTimers[key].flush();
    }
    for (const key of Object.keys(adCreatorUpdateTimers)) {
      clearTimeout(adCreatorUpdateTimers[key].timer);
      adCreatorUpdateTimers[key].flush();
    }
    // Cancel any in-flight creative generation timers
    while (_creativeTimers.length) clearTimeout(_creativeTimers.pop());

    set({ selectedStore: store });

    // Abort all in-flight loads to free browser connections
    _researchLoadController?.abort();
    _researchLoadController = null;
    _copyLoadController?.abort();
    _copyLoadController = null;
    _connectionsLoadController?.abort();
    _connectionsLoadController = null;
    _adCreatorLoadController?.abort();
    _adCreatorLoadController = null;

    // Set loading: true BEFORE clearing data so skeleton loaders appear during reload
    // (instead of a blank flash). Each module's loadProducts(storeId) useEffect will
    // fire and replace skeletons with fresh data.
    useResearchStore.setState({ sheetProducts: [], loading: true, error: null });
    useProductCopyStore.setState({ copyProducts: [], loading: true, error: null });
    useAdCreatorStore.setState({ campaigns: [], loading: true, error: null });
    useCreativeGeneratorStore.setState({ batchQueue: [], productCreatives: [], loaded: false });
    useConnectionsStore.setState({ connections: [], loading: true, loaded: false });
  },
}));

// ─── Connections Store ──────────────────────────────────
// Tracks which external services are connected for the current user.

import {
  fetchConnections,
  isServiceConnected,
  type ServiceConnection,
  type ServiceId,
} from "@/lib/services/connections";

interface ConnectionsStore {
  connections: ServiceConnection[];
  loading: boolean;
  loaded: boolean;
  loadConnections: () => Promise<void>;
  isConnected: (service: ServiceId) => boolean;
  removeConnection: (service: ServiceId) => void;
  getExpiryDaysLeft: (service: ServiceId) => number | null;
  getExpiringServices: (withinHours?: number) => { service: ServiceId; hoursLeft: number }[];
}

// AbortController for in-flight connections load
let _connectionsLoadController: AbortController | null = null;

export const useConnectionsStore = create<ConnectionsStore>((set, get) => ({
  connections: [],
  loading: false,
  loaded: false,

  loadConnections: async () => {
    const user = useAuthStore.getState().user;
    const store = useStoreContext.getState().selectedStore;
    if (!user) return;

    // If already loaded, skip the fetch — connections rarely change outside Settings
    if (get().loaded) return;

    // Abort any in-flight load to free the browser connection
    _connectionsLoadController?.abort();
    const controller = new AbortController();
    _connectionsLoadController = controller;

    set({ loading: true });
    try {
      const connections = await fetchConnections(user.id, store?.id, controller.signal);
      if (controller.signal.aborted) return;
      set({ connections, loading: false, loaded: true });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Failed to load connections:", err);
      if (!controller.signal.aborted) set({ loading: false, loaded: true });
    }
  },

  isConnected: (service) => isServiceConnected(get().connections, service),

  getExpiryDaysLeft: (service) => {
    const conn = get().connections.find((c) => c.service === service);
    if (!conn?.expiresAt) return null;
    const diff = new Date(conn.expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },

  getExpiringServices: (withinHours = 24) => {
    const now = Date.now();
    const threshold = withinHours * 60 * 60 * 1000;
    return get()
      .connections
      .filter((c) => {
        if (!c.expiresAt) return false;
        const diff = new Date(c.expiresAt).getTime() - now;
        return diff <= threshold; // includes already-expired (diff <= 0)
      })
      .map((c) => ({
        service: c.service,
        hoursLeft: Math.max(0, Math.ceil((new Date(c.expiresAt!).getTime() - now) / (1000 * 60 * 60))),
      }));
  },

  removeConnection: (service) => {
    set((s) => ({
      connections: s.connections.filter((c) => c.service !== service),
    }));
  },
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
  bannerVisible: false,
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
