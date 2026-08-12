import { useCallback, useState } from 'react'

/**
 * Drop-in replacement for `useState` that persists the value in `localStorage`.
 *
 * Accepts a raw initial value (same API as `useState`) — the stored value is
 * used instead when it exists.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? (JSON.parse(stored) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setStoredValue = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next =
          valueOrUpdater instanceof Function
            ? valueOrUpdater(prev)
            : valueOrUpdater
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // Storage full or private browsing — silently ignore.
        }
        return next
      })
    },
    [key],
  )

  return [value, setStoredValue] as const
}
