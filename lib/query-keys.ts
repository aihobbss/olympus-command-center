export const queryKeys = {
  products: {
    all: ["products"] as const,
    list: (storeId: string) => ["products", "list", storeId] as const,
  },
  productCopies: {
    all: ["productCopies"] as const,
    list: (storeId: string) => ["productCopies", "list", storeId] as const,
  },
};
