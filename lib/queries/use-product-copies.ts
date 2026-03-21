"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchProductCopies,
  updateProductCopy as updateProductCopyDB,
  deleteProductCopy as deleteProductCopyDB,
} from "@/lib/services/product-copy";
import {
  useStoreContext,
  useAuthStore,
  useCreativeGeneratorStore,
} from "@/lib/store";
import { authFetch } from "@/lib/supabase";
import type { ProductCopy, SheetProduct } from "@/data/mock";
// flushAllProductWrites imported by store.ts setSelectedStore via dynamic import

// ── Debounce infrastructure ──

type PendingWrite = {
  timer: ReturnType<typeof setTimeout>;
  flush: () => void;
  pendingUpdates: Partial<ProductCopy>;
};

const copyUpdateTimers: Record<string, PendingWrite> = {};

/** Flush all pending debounced product copy writes. */
export async function flushAllCopyWrites(): Promise<void> {
  for (const key of Object.keys(copyUpdateTimers)) {
    clearTimeout(copyUpdateTimers[key].timer);
    copyUpdateTimers[key].flush();
  }
}

// ── Query Hook ──

export function useProductCopiesQuery() {
  const storeId = useStoreContext((s) => s.selectedStore?.id);

  return useQuery({
    queryKey: queryKeys.productCopies.list(storeId ?? ""),
    queryFn: ({ signal }) => fetchProductCopies(storeId!, signal),
    enabled: !!storeId,
  });
}

// ── Update Copy Product (debounced, push status reset, reverse name propagation) ──

export function useUpdateCopyProduct() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);

  return useCallback(
    (id: string, updates: Partial<ProductCopy>) => {
      if (!storeId) return;

      // If content field changes on a pushed product, reset pushStatus
      const contentFields = [
        "productName",
        "shopifyDescription",
        "facebookCopy",
        "productUrl",
        "sizeChartTable",
      ];
      const currentData = queryClient.getQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId)
      );
      const current = currentData?.find((p) => p.id === id);
      if (
        current?.pushStatus === "pushed" &&
        contentFields.some((f) => f in updates)
      ) {
        updates = { ...updates, pushStatus: "" as const };
      }

      // 1. Optimistic cache update
      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) => old?.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );

      // 2. Debounced DB write (300ms)
      const existing = copyUpdateTimers[id];
      if (existing) clearTimeout(existing.timer);
      const accumulated = { ...(existing?.pendingUpdates ?? {}), ...updates };

      const capturedStoreId = storeId;
      const flush = () => {
        updateProductCopyDB(id, accumulated, capturedStoreId);
        delete copyUpdateTimers[id];
      };

      copyUpdateTimers[id] = {
        timer: setTimeout(flush, 300),
        flush,
        pendingUpdates: accumulated,
      };

      // 3. Reverse name propagation to products cache
      if (updates.productName && current?.productId) {
        queryClient.setQueryData<SheetProduct[]>(
          queryKeys.products.list(storeId),
          (old) =>
            old?.map((p) =>
              p.id === current.productId
                ? { ...p, productName: updates.productName! }
                : p
            )
        );
        // Also debounce-write the product name change to DB
        // Import dynamically to avoid circular dependency
        import("@/lib/services/products").then((m) =>
          m.updateProduct(current.productId!, { productName: updates.productName }, capturedStoreId)
        );
      }
    },
    [queryClient, storeId]
  );
}

// ── Delete Copy Product ──

export function useDeleteCopyProduct() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);

  return useMutation({
    mutationFn: (id: string) => deleteProductCopyDB(id, storeId),
    onMutate: async (id) => {
      if (!storeId) return;
      await queryClient.cancelQueries({
        queryKey: queryKeys.productCopies.list(storeId),
      });

      const previous = queryClient.getQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId)
      );

      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) => old?.filter((p) => p.id !== id)
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous && storeId) {
        queryClient.setQueryData(
          queryKeys.productCopies.list(storeId),
          context.previous
        );
      }
    },
  });
}

// ── Generate Copy (Claude API) ──

export function useGenerateCopy() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);
  const store = useStoreContext((s) => s.selectedStore);

  return useMutation({
    mutationFn: async (id: string) => {
      const copies = queryClient.getQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId!)
      );
      const product = copies?.find((p) => p.id === id);

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
          productCopyId: id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.statusText);
      }

      return { id, data: await res.json(), sizeChartImage: product?.sizeChartImage, sizeChartStatus: product?.sizeChartStatus };
    },
    onMutate: (id) => {
      if (!storeId) return;
      // Set "Generating" optimistically
      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) =>
            p.id === id ? { ...p, status: "Generating" as const } : p
          )
      );
      updateProductCopyDB(id, { status: "Generating" }, storeId);
    },
    onSuccess: ({ id, data, sizeChartImage, sizeChartStatus }) => {
      if (!storeId) return;
      const updates: Partial<ProductCopy> = {
        status: "Completed" as const,
        shopifyDescription: data.shopifyDescription || "",
        facebookCopy: data.facebookCopy || "",
        ...(data.cleanedTitle ? { productName: data.cleanedTitle } : {}),
      };

      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
      updateProductCopyDB(id, updates, storeId);

      // Auto-generate size chart if image attached and not yet generated
      if (
        sizeChartImage &&
        sizeChartStatus !== "done" &&
        sizeChartStatus !== "generating"
      ) {
        // Will be called by the component that has the generateSizeChart mutation
        // We trigger by dispatching a custom event the component can listen to
        window.dispatchEvent(
          new CustomEvent("auto-generate-size-chart", { detail: { id } })
        );
      }
    },
    onError: (_err, id) => {
      if (!storeId) return;
      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) =>
            p.id === id ? { ...p, status: "Error" as const } : p
          )
      );
      updateProductCopyDB(id, { status: "Error" }, storeId);
    },
  });
}

// ── Push to Shopify ──

export function usePushToStore() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);
  const store = useStoreContext((s) => s.selectedStore);

  return useMutation({
    mutationFn: async (id: string) => {
      // Guard: skip if already pushing/pushed (matches onMutate guard)
      const copies = queryClient.getQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId!)
      );
      const product = copies?.find((p) => p.id === id);
      if (product?.pushStatus === "pushing" || product?.pushStatus === "pushed") {
        return { id, shopifyProductId: product.shopifyProductId, product, skipped: true };
      }

      const user = useAuthStore.getState().user;

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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.statusText);
      }

      const data = await res.json();
      return { id, shopifyProductId: data.shopifyProductId, product, skipped: false };
    },
    onMutate: (id) => {
      if (!storeId) return;

      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) =>
            p.id === id ? { ...p, pushStatus: "pushing" as const } : p
          )
      );
      updateProductCopyDB(id, { pushStatus: "pushing" }, storeId);
    },
    onSuccess: ({ id, shopifyProductId, product, skipped }) => {
      if (!storeId || skipped) return;
      const updates: Partial<ProductCopy> = {
        pushStatus: "pushed" as const,
        shopifyProductId: shopifyProductId || undefined,
      };

      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
      updateProductCopyDB(id, updates, storeId);

      // Cross-module: auto-add to Creative Generator batch queue
      if (product) {
        const currentQueue =
          useCreativeGeneratorStore.getState().batchQueue;
        const alreadyQueued = currentQueue.some(
          (q) => q.productCopyId === id
        );
        if (!alreadyQueued) {
          useCreativeGeneratorStore.setState((s) => ({
            batchQueue: [
              ...s.batchQueue,
              {
                id: `bq-${Date.now()}-${id}`,
                productId: product.productId,
                productCopyId: id,
                productName: product.productName,
                productUrl: product.productUrl,
                imageUrl: product.imageUrl,
                status: "queued" as const,
              },
            ],
          }));
        }
      }
    },
    onError: (_err, id) => {
      if (!storeId) return;
      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) =>
            p.id === id ? { ...p, pushStatus: "error" as const } : p
          )
      );
      updateProductCopyDB(id, { pushStatus: "error" }, storeId);
    },
  });
}

// ── Generate Size Chart (Claude Vision) ──

export function useGenerateSizeChart() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);
  const store = useStoreContext((s) => s.selectedStore);

  return useMutation({
    mutationFn: async (id: string) => {
      const copies = queryClient.getQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId!)
      );
      const product = copies?.find((p) => p.id === id);

      const res = await authFetch("/api/generate-size-chart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageUrl: product?.sizeChartImage || "",
          storeId: store?.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.statusText);
      }

      const data = await res.json();
      const wasPushed = product?.pushStatus === "pushed";
      return { id, sizeChartTable: data.sizeChartTable || "", wasPushed };
    },
    onMutate: (id) => {
      if (!storeId) return;
      // Guard: skip if already generating
      const copies = queryClient.getQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId)
      );
      const current = copies?.find((p) => p.id === id);
      if (current?.sizeChartStatus === "generating") return;

      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) =>
            p.id === id
              ? { ...p, sizeChartStatus: "generating" as const }
              : p
          )
      );
      updateProductCopyDB(id, { sizeChartStatus: "generating" }, storeId);
    },
    onSuccess: ({ id, sizeChartTable, wasPushed }) => {
      if (!storeId) return;
      const updates: Partial<ProductCopy> = {
        sizeChartStatus: "done" as const,
        sizeChartTable,
        ...(wasPushed ? { pushStatus: "" as const } : {}),
      };

      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
      updateProductCopyDB(id, updates, storeId);
    },
    onError: (_err, id) => {
      if (!storeId) return;
      queryClient.setQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId),
        (old) =>
          old?.map((p) =>
            p.id === id
              ? { ...p, sizeChartStatus: "error" as const }
              : p
          )
      );
      updateProductCopyDB(id, { sizeChartStatus: "error" }, storeId);
    },
  });
}

// ── Generate All (staggered) ──

export function useGenerateAll() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);
  const generateCopy = useGenerateCopy();

  return useCallback(() => {
    if (!storeId) return;
    const copies =
      queryClient.getQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId)
      ) ?? [];
    const pending = copies.filter(
      (p) => p.status === "" || p.status === "Pending"
    );
    pending.forEach((p, i) => {
      setTimeout(() => generateCopy.mutate(p.id), i * 400);
    });
  }, [queryClient, storeId, generateCopy]);
}

// ── Push All to Store (staggered) ──

export function usePushAllToStore() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);
  const pushToStore = usePushToStore();

  return useCallback(() => {
    if (!storeId) return;
    const copies =
      queryClient.getQueryData<ProductCopy[]>(
        queryKeys.productCopies.list(storeId)
      ) ?? [];
    const ready = copies.filter(
      (p) => p.status === "Completed" && p.pushStatus === ""
    );
    ready.forEach((p, i) => {
      setTimeout(() => pushToStore.mutate(p.id), i * 300);
    });
  }, [queryClient, storeId, pushToStore]);
}
