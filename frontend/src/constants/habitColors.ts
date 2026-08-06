import type { CSSProperties } from 'react'

/**
 * The accent a habit is tinted with.
 *
 * The stored value *is* the colour — a `#rrggbb` hex — rather than a key into a palette
 * that then has to be translated into Tailwind classes. That translation is what forced the
 * six accents to be a closed set: Tailwind scans source for literal class strings, so
 * `bg-${color}-500` would have been purged and every shade had to be written out by hand.
 * With the hex in hand the tints are computed, so `ACCENTS` is only the row of swatches the
 * form offers as a quick path — any hex renders.
 *
 * Colours come back as inline style objects for the same reason. The one exception is the
 * focus ring, which stays on Tailwind's `ring-2` utility and gets its colour through the
 * `--tw-ring-color` variable that utility already reads.
 */

export interface HabitAccent {
  /** `#rrggbb`. This is what is stored on the habit. */
  hex: string
  label: string
}

/** The hexes the palette used to reach through Tailwind class names. */
export const ACCENTS: HabitAccent[] = [
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#22d3ee', label: 'Cyan' },
  { hex: '#a78bfa', label: 'Violet' },
  { hex: '#a3e635', label: 'Lime' },
  { hex: '#fbbf24', label: 'Amber' },
  { hex: '#38bdf8', label: 'Sky' },
]

export const DEFAULT_COLOR = ACCENTS[0].hex

const HEX = /^#[0-9a-f]{6}$/i

/** `#ec4899` + 0.5 → `rgba(236, 72, 153, 0.5)`. Assumes a validated six-digit hex. */
export function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 0xff
  const g = (value >> 8) & 0xff
  const b = value & 0xff

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Unlogged days keep the neutral wash they had as a class. */
const EMPTY_LEVEL = 'rgba(39, 39, 42, 0.6)'

export interface Accent {
  hex: string
  /** The big check box when filled, the FAB, and the save button. */
  solid: CSSProperties
  /** Spread onto an element that also carries Tailwind's `ring-2`. */
  ring: CSSProperties
  text: CSSProperties
  /** Indexed by `HeatmapCell.level`: 0 is an unlogged day, 4 is target met. */
  levels: [string, string, string, string, string]
}

/**
 * Falls back to the first accent on anything that isn't a six-digit hex, so a value stored
 * before the migration — or any other junk — can't render colourless.
 */
export function accentOf(color: string): Accent {
  const hex = HEX.test(color) ? color : DEFAULT_COLOR

  return {
    hex,
    solid: { backgroundColor: hex },
    ring: { '--tw-ring-color': hex } as CSSProperties,
    text: { color: hex },
    levels: [
      EMPTY_LEVEL,
      withAlpha(hex, 0.25),
      withAlpha(hex, 0.5),
      withAlpha(hex, 0.75),
      hex,
    ],
  }
}

/** Offered in the habit form. Nothing enforces this list — any emoji is stored as-is. */
export const HABIT_EMOJIS = [
  '✅', '📚', '🏃', '💪', '🧘', '💧', '🥗', '😴',
  '🎸', '🖊️', '🧹', '💊', '🌱', '🎨', '🧠', '☕',
  '🚭', '📵', '🙏', '🗣️', '💰', '🐕',
]
