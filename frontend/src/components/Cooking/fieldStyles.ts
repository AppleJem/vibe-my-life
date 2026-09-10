/**
 * The Cooking app's form field look. Same shape as the habits one, in the amber the app is
 * accented with — the focus ring is the only part that differs, and it has to match the
 * surrounding buttons or a focused field looks like it belongs to another screen.
 */
export const INPUT =
  'w-full px-3 py-2 text-base bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent'

/** The emoji the recipe form offers as a quick path. Any emoji is stored as-is. */
export const RECIPE_EMOJIS = [
  '🍽️', '🍜', '🍝', '🍲', '🥘', '🍛', '🍚', '🍞',
  '🥐', '🧁', '🍰', '🍪', '🥗', '🌮', '🍕', '🍔',
  '🥞', '🍳', '🐟', '🍗', '🥩', '🍤', '🍣', '🥟',
  '☕', '🥤', '🍸', '🧀',
]
