import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { metadataApi, type CategoryRename } from '../services/api'
import { getRates } from '../services/rates'
import { DEFAULT_CATEGORIES, type Category } from '../constants/categories'
import { DEFAULT_BASE_CURRENCY } from '../constants/currencies'

const INPUT_CURRENCY_KEY = 'vml.inputCurrency'

interface CategoriesValue {
  categories: Category[]
  loading: boolean
  error: string | null
  saveCategories: (categories: Category[], renames: CategoryRename[]) => Promise<void>
  /** Re-reads settings from the server — used after an import creates categories. */
  refreshMetadata: () => Promise<void>
}

interface CurrencyValue {
  baseCurrency: string
  /** Base first, then the additional currencies — this is the picker order. */
  currencies: string[]
  /** Units of each currency per 1 unit of base. Empty until the fetch/cache resolves. */
  rates: Record<string, number>
  ratesFetchedAt: number | null
  ratesError: string | null
  loading: boolean
  error: string | null
  saveCurrency: (baseCurrency: string, currencies: string[]) => Promise<void>
  /** Currency preselected for new expenses, remembered across sessions. */
  inputCurrency: string
  setInputCurrency: (code: string) => void
}

interface MetadataContextValue extends CategoriesValue, CurrencyValue {}

const MetadataContext = createContext<MetadataContextValue | null>(null)

function readStoredInputCurrency(): string | null {
  try {
    return localStorage.getItem(INPUT_CURRENCY_KEY)
  } catch {
    return null
  }
}

export function MetadataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY)
  const [extraCurrencies, setExtraCurrencies] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rates, setRates] = useState<Record<string, number>>({})
  const [ratesFetchedAt, setRatesFetchedAt] = useState<number | null>(null)
  const [ratesError, setRatesError] = useState<string | null>(null)

  const [storedInputCurrency, setStoredInputCurrency] = useState<string | null>(
    readStoredInputCurrency
  )

  // One metadata request serves both the categories and the currency slices.
  useEffect(() => {
    let cancelled = false

    metadataApi
      .getMetadata()
      .then((metadata) => {
        if (cancelled) return
        setCategories(metadata.categories)
        setBaseCurrency(metadata.baseCurrency)
        setExtraCurrencies(metadata.currencies)
      })
      .catch((err) => {
        console.error(err)
        // Keep the defaults so the app stays usable
        if (!cancelled) setError('Failed to load settings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Rates are keyed to the base, so a base change invalidates them.
  useEffect(() => {
    let cancelled = false

    getRates(baseCurrency)
      .then((cached) => {
        if (cancelled) return
        setRates(cached.rates)
        setRatesFetchedAt(cached.fetchedAt)
        setRatesError(null)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setRatesError('Failed to load exchange rates')
      })

    return () => {
      cancelled = true
    }
  }, [baseCurrency])

  const currencies = [baseCurrency, ...extraCurrencies.filter((c) => c !== baseCurrency)]

  // A currency that has since been removed from settings must not stay selected.
  const inputCurrency =
    storedInputCurrency && currencies.includes(storedInputCurrency)
      ? storedInputCurrency
      : baseCurrency

  const setInputCurrency = useCallback((code: string) => {
    setStoredInputCurrency(code)
    try {
      localStorage.setItem(INPUT_CURRENCY_KEY, code)
    } catch {
      // Non-fatal: the selection just won't survive a reload.
    }
  }, [])

  const refreshMetadata = useCallback(async () => {
    const metadata = await metadataApi.getMetadata()
    setCategories(metadata.categories)
    setBaseCurrency(metadata.baseCurrency)
    setExtraCurrencies(metadata.currencies)
  }, [])

  const saveCategories = useCallback(async (next: Category[], renames: CategoryRename[]) => {
    const metadata = await metadataApi.saveCategories(next, renames)
    setCategories(metadata.categories)
  }, [])

  const saveCurrency = useCallback(async (nextBase: string, nextCurrencies: string[]) => {
    const metadata = await metadataApi.saveCurrency(nextBase, nextCurrencies)
    setBaseCurrency(metadata.baseCurrency)
    setExtraCurrencies(metadata.currencies)
  }, [])

  return (
    <MetadataContext.Provider
      value={{
        categories,
        loading,
        error,
        saveCategories,
        refreshMetadata,
        baseCurrency,
        currencies,
        rates,
        ratesFetchedAt,
        ratesError,
        saveCurrency,
        inputCurrency,
        setInputCurrency,
      }}
    >
      {children}
    </MetadataContext.Provider>
  )
}

function useMetadata(): MetadataContextValue {
  const ctx = useContext(MetadataContext)
  if (!ctx) throw new Error('useMetadata must be used within a MetadataProvider')
  return ctx
}

export function useCategories(): CategoriesValue {
  return useMetadata()
}

export function useCurrency(): CurrencyValue {
  return useMetadata()
}
