import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min — matches Ad Manager staleness check
      gcTime: 10 * 60 * 1000, // 10 min — keep cache for back-navigation
      refetchOnWindowFocus: "always", // replaces manual visibilitychange listeners
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
