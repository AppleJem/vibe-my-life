export interface Category {
  name: string
  subcategories: string[]
}

/**
 * An expense's `category` is a single string encoding at most one level of nesting,
 * with `#` as the separator: "🍜 Food" or "🍜 Food#Drinks". The emoji is just part
 * of the name, so there is no separate icon lookup.
 */
export const CATEGORY_SEPARATOR = '#'

// Only used as a fallback if the user's metadata fails to load; the backend seeds
// the real list on first request.
export const DEFAULT_CATEGORIES: Category[] = [
  { name: '🍜 Food', subcategories: [] },
  { name: '🚗 Transport', subcategories: [] },
  { name: '🏠 Household', subcategories: [] },
  { name: '👕 Apparel', subcategories: [] },
  { name: '⚽ Sports', subcategories: [] },
  { name: '📚 Education', subcategories: [] },
  { name: '🎁 Gift', subcategories: [] },
  { name: '🛒 Shopping', subcategories: [] },
  { name: '🏥 Medical', subcategories: [] },
  { name: '💕 Dating', subcategories: [] },
  { name: '✈️ Travel', subcategories: [] },
  { name: '📦 Other', subcategories: [] },
]

// Income keeps a completely separate list — names may overlap (🎁 Gift is in both)
// and the two never mix in a picker or a chart.
export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { name: '💰 Salary', subcategories: [] },
  { name: '🎉 Bonus', subcategories: [] },
  { name: '📈 Investment', subcategories: [] },
  { name: '💼 Freelance', subcategories: [] },
  { name: '🎁 Gift', subcategories: [] },
  { name: '🔄 Refund', subcategories: [] },
  { name: '🏠 Rental', subcategories: [] },
  { name: '📦 Other', subcategories: [] },
]

export function parseCategory(value: string): { parent: string; sub?: string } {
  const index = value.indexOf(CATEGORY_SEPARATOR)
  if (index === -1) return { parent: value }

  return {
    parent: value.slice(0, index),
    sub: value.slice(index + 1) || undefined,
  }
}

export function formatCategory(parent: string, sub?: string): string {
  return sub ? `${parent}${CATEGORY_SEPARATOR}${sub}` : parent
}

export function displayCategory(value: string): string {
  const { parent, sub } = parseCategory(value)
  return sub ? `${parent} › ${sub}` : parent
}

/** Returns an error message, or null if the name is valid. */
export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name cannot be empty'
  if (trimmed.includes(CATEGORY_SEPARATOR)) return `Name cannot contain "${CATEGORY_SEPARATOR}"`
  return null
}
