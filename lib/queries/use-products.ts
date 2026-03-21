"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchProducts,
  createProduct,
  updateProduct as updateProductDB,
  deleteProduct as deleteProductDB,
  bulkUpdateStatus,
} from "@/lib/services/products";
import {
  useStoreContext,
  useCreativeGeneratorStore,
  useAdCreatorStore,
} from "@/lib/store";
import type { SheetProduct, ProductCopy } from "@/data/mock";

// ── Debounce infrastructure (module-level, same pattern as before) ──

type PendingWrite = {
  timer: ReturnType<typeof setTimeout>;
  flush: () => void;
  pendingUpdates: Partial<SheetProduct>;
};

const productUpdateTimers: Record<string, PendingWrite> = {};
const _pendingWritePromises: Promise<unknown>[] = [];

/** Flush all pending debounced product writes. Call before store switch or navigation. */
export async function flushAllProductWrites(): Promise<void> {
  for (const key of Object.keys(productUpdateTimers)) {
    clearTimeout(productUpdateTimers[key].timer);
    productUpdateTimers[key].flush();
  }
  if (_pendingWritePromises.length > 0) {
    let timeoutId: ReturnType<typeof setTimeout>;
    await Promise.race([
      Promise.allSettled(_pendingWritePromises),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, 5_000);
      }),
    ]);
    clearTimeout(timeoutId!);
    _pendingWritePromises.length = 0;
  }
}

// ── Query Hook ──

export function useProductsQuery() {
  const storeId = useStoreContext((s) => s.selectedStore?.id);

  return useQuery({
    queryKey: queryKeys.products.list(storeId ?? ""),
    queryFn: ({ signal }) => fetchProducts(storeId!, signal),
    enabled: !!storeId,
  });
}

// ── Update (debounced, with cross-module propagation) ──

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);

  return useCallback(
    (id: string, updates: Partial<SheetProduct>) => {
      if (!storeId) return;

      // 1. Optimistic cache update (instant UI)
      queryClient.setQueryData<SheetProduct[]>(
        queryKeys.products.list(storeId),
        (old) => old?.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );

      // 2. Debounced DB write (300ms, accumulating)
      const existing = productUpdateTimers[id];
      if (existing) clearTimeout(existing.timer);
      const accumulated = { ...(existing?.pendingUpdates ?? {}), ...updates };

      const flush = () => {
        const p = updateProductDB(id, accumulated, storeId);
        _pendingWritePromises.push(p);
        delete productUpdateTimers[id];
      };

      productUpdateTimers[id] = {
        timer: setTimeout(flush, 300),
        flush,
        pendingUpdates: accumulated,
      };

      // 3. Cross-module name propagation
      if (updates.productName) {
        const newName = updates.productName;

        // Update ProductCopy cache
        queryClient.setQueryData<ProductCopy[]>(
          queryKeys.productCopies.list(storeId),
          (old) =>
            old?.map((p) =>
              p.productId === id ? { ...p, productName: newName } : p
            )
        );

        // Update CreativeGenerator store (not migrated)
        useCreativeGeneratorStore.setState((s) => ({
          batchQueue: s.batchQueue.map((p) =>
            p.productId === id ? { ...p, productName: newName } : p
          ),
          productCreatives: s.productCreatives.map((p) =>
            p.productId === id ? { ...p, productName: newName } : p
          ),
        }));

        // Update AdCreator store (not migrated)
        useAdCreatorStore.setState((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.productId === id ? { ...c, productName: newName } : c
          ),
        }));
      }
    },
    [queryClient, storeId]
  );
}

// ── Add Product ──

export function useAddProduct() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);

  return useMutation({
    mutationFn: () => createProduct(storeId!),
    onSuccess: (newProduct) => {
      if (newProduct && storeId) {
        queryClient.setQueryData<SheetProduct[]>(
          queryKeys.products.list(storeId),
          (old) => [...(old ?? []), newProduct]
        );
      }
    },
  });
}

// ── Delete Product (optimistic with rollback) ──

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);

  return useMutation({
    mutationFn: (id: string) => {
      // Cancel any pending debounced writes for this product
      if (productUpdateTimers[id]) {
        clearTimeout(productUpdateTimers[id].timer);
        delete productUpdateTimers[id];
      }
      return deleteProductDB(id, storeId);
    },
    onMutate: async (id) => {
      if (!storeId) return;
      await queryClient.cancelQueries({
        queryKey: queryKeys.products.list(storeId),
      });

      const previous = queryClient.getQueryData<SheetProduct[]>(
        queryKeys.products.list(storeId)
      );

      queryClient.setQueryData<SheetProduct[]>(
        queryKeys.products.list(storeId),
        (old) => old?.filter((p) => p.id !== id)
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous && storeId) {
        queryClient.setQueryData(
          queryKeys.products.list(storeId),
          context.previous
        );
      }
    },
  });
}

// ── Import All Unimported (bulk status update) ──

export function useImportAllUnimported() {
  const queryClient = useQueryClient();
  const storeId = useStoreContext((s) => s.selectedStore?.id);

  return useMutation({
    mutationFn: (ids: string[]) => bulkUpdateStatus(ids, "Queued", storeId),
    onMutate: async () => {
      if (!storeId) return;
      const previous = queryClient.getQueryData<SheetProduct[]>(
        queryKeys.products.list(storeId)
      );

      queryClient.setQueryData<SheetProduct[]>(
        queryKeys.products.list(storeId),
        (old) =>
          old?.map((p) =>
            !p.testingStatus
              ? { ...p, testingStatus: "Queued" as const }
              : p
          )
      );

      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous && storeId) {
        queryClient.setQueryData(
          queryKeys.products.list(storeId),
          context.previous
        );
      }
    },
  });
}
