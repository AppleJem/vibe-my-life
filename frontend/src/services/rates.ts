const CACHE_KEY = 'vml.rates.v1'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Rates are units of the target currency per 1 unit of `base`. */
export interface CachedRates {
  base: string
  rates: Record<string, number>
  fetchedAt: number
}

interface ErApiResponse {
  result: 'success' | 'error'
  base_code: string
  rates: Record<string, number>
}

export function loadCachedRates(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as CachedRates
    if (!parsed?.base || !parsed?.rates || typeof parsed.fetchedAt !== 'number') return null

    return parsed
  } catch {
    return null
  }
}

function saveCachedRates(cached: CachedRates) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
  } catch {
    // Private-mode Safari and full quotas throw here; the rates still work for this session.
  }
}

export async function fetchRates(base: string): Promise<CachedRates> {
  // open.er-api.com: no API key, CORS-open, one request returns every currency.
  const response = await fetch(`https://open.er-api.com/v6/latest/${base}`)
  if (!response.ok) throw new Error(`Rate fetch failed: ${response.status}`)

  const data = (await response.json()) as ErApiResponse
  if (data.result !== 'success' || !data.rates) throw new Error('Rate fetch returned no rates')

  const cached: CachedRates = {
    base: data.base_code ?? base,
    rates: data.rates,
    fetchedAt: Date.now(),
  }
  saveCachedRates(cached)
  return cached
}

/**
 * Returns cached rates when they're for the right base and less than a day old, so
 * adding an expense never waits on the network. On a failed refetch the stale cache
 * is preferred over throwing — an out-of-date rate beats a broken form.
 */
export async function getRates(base: string): Promise<CachedRates> {
  const cached = loadCachedRates()
  const isFresh =
    cached && cached.base === base && Date.now() - cached.fetchedAt < MAX_AGE_MS

  if (isFresh) return cached

  try {
    return await fetchRates(base)
  } catch (err) {
    if (cached && cached.base === base) return cached
    throw err
  }
}
