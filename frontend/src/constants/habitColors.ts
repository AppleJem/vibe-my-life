/**
 * The accent a habit is tinted with. Every class is written out in full — Tailwind scans
 * source for literal strings, so a constructed `bg-${color}-500` would be purged.
 *
 * `levels` is indexed by `HeatmapCell.level`: 0 is an unlogged day, 4 is target met.
 */
export interface HabitAccent {
  key: string
  label: string
  /** The big check box when filled, and the FAB. */
  solid: string
  /** Ring around the box while idle / holding. */
  ring: string
  text: string
  levels: [string, string, string, string, string]
}

const EMPTY = 'bg-zinc-800/60'

export const ACCENTS: HabitAccent[] = [
  {
    key: 'pink',
    label: 'Pink',
    solid: 'bg-pink-500',
    ring: 'ring-pink-500',
    text: 'text-pink-500',
    levels: [EMPTY, 'bg-pink-500/25', 'bg-pink-500/50', 'bg-pink-500/75', 'bg-pink-500'],
  },
  {
    key: 'cyan',
    label: 'Cyan',
    solid: 'bg-cyan-400',
    ring: 'ring-cyan-400',
    text: 'text-cyan-400',
    levels: [EMPTY, 'bg-cyan-400/25', 'bg-cyan-400/50', 'bg-cyan-400/75', 'bg-cyan-400'],
  },
  {
    key: 'violet',
    label: 'Violet',
    solid: 'bg-violet-400',
    ring: 'ring-violet-400',
    text: 'text-violet-400',
    levels: [EMPTY, 'bg-violet-400/25', 'bg-violet-400/50', 'bg-violet-400/75', 'bg-violet-400'],
  },
  {
    key: 'lime',
    label: 'Lime',
    solid: 'bg-lime-400',
    ring: 'ring-lime-400',
    text: 'text-lime-400',
    levels: [EMPTY, 'bg-lime-400/25', 'bg-lime-400/50', 'bg-lime-400/75', 'bg-lime-400'],
  },
  {
    key: 'amber',
    label: 'Amber',
    solid: 'bg-amber-400',
    ring: 'ring-amber-400',
    text: 'text-amber-400',
    levels: [EMPTY, 'bg-amber-400/25', 'bg-amber-400/50', 'bg-amber-400/75', 'bg-amber-400'],
  },
  {
    key: 'sky',
    label: 'Sky',
    solid: 'bg-sky-400',
    ring: 'ring-sky-400',
    text: 'text-sky-400',
    levels: [EMPTY, 'bg-sky-400/25', 'bg-sky-400/50', 'bg-sky-400/75', 'bg-sky-400'],
  },
]

/** Falls back to the first accent, so an unknown stored key can't render colourless. */
export const accentOf = (key: string): HabitAccent =>
  ACCENTS.find((accent) => accent.key === key) ?? ACCENTS[0]

/** Offered in the habit form. Nothing enforces this list — any emoji is stored as-is. */
export const HABIT_EMOJIS = [
  '✅', '📚', '🏃', '💪', '🧘', '💧', '🥗', '😴',
  '🎸', '🖊️', '🧹', '💊', '🌱', '🎨', '🧠', '☕',
  '🚭', '📵', '🙏', '🗣️', '💰', '🐕',
]
