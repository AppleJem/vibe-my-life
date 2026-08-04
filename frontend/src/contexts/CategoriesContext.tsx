import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { metadataApi, type CategoryRename } from '../services/api'
import { DEFAULT_CATEGORIES, type Category } from '../constants/categories'

interface CategoriesContextValue {
  categories: Category[]
  loading: boolean
  error: string | null
  saveCategories: (categories: Category[], renames: CategoryRename[]) => Promise<void>
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null)

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    metadataApi
      .getMetadata()
      .then((metadata) => {
        if (!cancelled) setCategories(metadata.categories)
      })
      .catch((err) => {
        console.error(err)
        // Keep DEFAULT_CATEGORIES so the app stays usable
        if (!cancelled) setError('Failed to load categories')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const saveCategories = useCallback(async (next: Category[], renames: CategoryRename[]) => {
    const metadata = await metadataApi.saveCategories(next, renames)
    setCategories(metadata.categories)
  }, [])

  return (
    <CategoriesContext.Provider value={{ categories, loading, error, saveCategories }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used within a CategoriesProvider')
  return ctx
}
