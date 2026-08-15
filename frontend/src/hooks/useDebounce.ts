import { useState, useEffect } from 'react'

/**
 * Debounces a value by `delay` ms. The returned value only updates after the
 * input has been stable for the full delay period.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
