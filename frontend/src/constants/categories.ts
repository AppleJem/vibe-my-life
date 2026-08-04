export const CATEGORIES = [
  { key: 'food', label: 'Food', emoji: '🍜' },
  { key: 'transport', label: 'Transport', emoji: '🚗' },
  { key: 'household', label: 'Household', emoji: '🏠' },
  { key: 'apparel', label: 'Apparel', emoji: '👕' },
  { key: 'sports', label: 'Sports', emoji: '⚽' },
  { key: 'education', label: 'Education', emoji: '📚' },
  { key: 'gift', label: 'Gift', emoji: '🎁' },
  { key: 'shopping', label: 'Shopping', emoji: '🛒' },
  { key: 'medical', label: 'Medical', emoji: '🏥' },
  { key: 'dating', label: 'Dating', emoji: '💕' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'other', label: 'Other', emoji: '📦' },
] as const

export type CategoryKey = (typeof CATEGORIES)[number]['key']

export function getCategoryByKey(key: string) {
  return CATEGORIES.find((c) => c.key === key)
}
