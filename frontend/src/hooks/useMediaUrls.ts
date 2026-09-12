import { useQuery } from '@tanstack/react-query'
import { mediaApi } from '../services/api'

/**
 * Presigned read URLs for a page's worth of media keys, in one request.
 *
 * The server signs for an hour; this refetches at 45 minutes, so a URL never expires under
 * a viewer who left the session screen open. Keys are sorted into the query key so the same
 * set of media in a different order is one cache entry, not two.
 */
export function useMediaUrls(keys: string[]) {
  const sorted = [...new Set(keys)].sort()

  const { data } = useQuery({
    queryKey: ['media', 'urls', sorted],
    queryFn: () => mediaApi.viewUrls(sorted),
    enabled: sorted.length > 0,
    staleTime: 45 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // A refetch that re-signs everything on every window focus is wasted work — the URLs
    // in hand are good for the best part of an hour.
    refetchOnWindowFocus: false,
  })

  return data ?? {}
}

/**
 * Whether the server has object storage configured at all. Cached for the session: it is a
 * deployment fact, not something that changes while the app is open.
 */
export function useMediaEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ['media', 'enabled'],
    queryFn: () => mediaApi.isEnabled(),
    staleTime: Infinity,
    retry: false,
  })

  return data ?? false
}
