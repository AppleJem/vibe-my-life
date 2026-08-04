import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A month visited in the last 5 minutes is reused without a network call,
      // so swiping back and forth between months costs nothing.
      staleTime: 5 * 60 * 1000,
      // Keep months resident well past staleTime: a stale revisit then renders
      // instantly from cache and refreshes behind the list instead of flashing
      // the skeleton.
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
