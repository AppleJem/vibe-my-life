import type { Quantity } from '../types/recipe'

/**
 * Servings scaling and US ↔ metric conversion — the two transformations every amount in a
 * recipe passes through before it is read, whether it sits in the ingredient list or inside
 * a step's prose.
 *
 * Both are display-only. Nothing here is ever written back: the stored recipe keeps the
 * amounts and units it was written with, and `servings` on the recipe is the yield those
 * amounts are *for*. A reader picking 6 servings of a recipe written for 4 is looking at
 * stored values times 1.5, which is why neither the stepper nor the unit toggle is a save.
 *
 * The unit tokens here mirror `backend/src/modules/recipe/recipe.units.ts`, which is what
 * normalises whatever the parser read into them. A token missing from this table is not a
 * crash: it falls through as a free-text unit, which scales but does not convert.
 */

export type UnitSystem = 'us' | 'metric'

/**
 * `count` covers cloves, pinches and cans — real units with no counterpart in the other
 * system, so they scale and never convert.
 */
type Dimension = 'volume' | 'mass' | 'length' | 'temperature' | 'count'

interface UnitDef {
  dimension: Dimension
  /** Null for count units, which belong to neither system. */
  system: UnitSystem | null
  /** Multiplier into the dimension's base unit: ml, g, or mm. Absent where conversion is special. */
  factor?: number
  /** Singular label, as rendered. */
  label: string
  /** Absent means the label doesn't inflect — symbols never do. */
  plural?: string
  /**
   * Never converted, in either direction. Teaspoons and tablespoons are the same spoon in
   * every kitchen on earth, so turning "1 tbsp" into "14.8 ml" loses the instruction and
   * gains nothing.
   */
  fixed?: boolean
  /**
   * Parsed and scaled, but never produced by a conversion. Pints and gallons are real
   * measures that recipes use; they are just not what a reader wants a converted amount
   * rendered *as* — see `TARGETS`.
   */
  noTarget?: boolean
}

const UNITS: Record<string, UnitDef> = {
  // Volume, US. Base is ml.
  tsp: { dimension: 'volume', system: 'us', factor: 4.92892, label: 'tsp', fixed: true },
  tbsp: { dimension: 'volume', system: 'us', factor: 14.7868, label: 'tbsp', fixed: true },
  'fl-oz': { dimension: 'volume', system: 'us', factor: 29.5735, label: 'fl oz' },
  cup: { dimension: 'volume', system: 'us', factor: 236.588, label: 'cup', plural: 'cups' },
  pint: { dimension: 'volume', system: 'us', factor: 473.176, label: 'pint', plural: 'pints', noTarget: true },
  quart: { dimension: 'volume', system: 'us', factor: 946.353, label: 'quart', plural: 'quarts', noTarget: true },
  gallon: { dimension: 'volume', system: 'us', factor: 3785.41, label: 'gallon', plural: 'gallons', noTarget: true },
  // Not a standard measure anywhere, but household recipes are written with it and it reads
  // as a volume. Two cups, which is the common soup bowl — an approximation by nature,
  // which is why it converts *out* but is never converted *into*.
  bowl: { dimension: 'volume', system: 'us', factor: 473.176, label: 'bowl', plural: 'bowls', noTarget: true },

  // Volume, metric
  ml: { dimension: 'volume', system: 'metric', factor: 1, label: 'ml' },
  l: { dimension: 'volume', system: 'metric', factor: 1000, label: 'l' },

  // Mass. Base is g.
  oz: { dimension: 'mass', system: 'us', factor: 28.3495, label: 'oz' },
  lb: { dimension: 'mass', system: 'us', factor: 453.592, label: 'lb' },
  g: { dimension: 'mass', system: 'metric', factor: 1, label: 'g' },
  kg: { dimension: 'mass', system: 'metric', factor: 1000, label: 'kg' },

  // Length. Base is mm. Converts, but never scales — see `scales` below.
  inch: { dimension: 'length', system: 'us', factor: 25.4, label: 'inch', plural: 'inches' },
  cm: { dimension: 'length', system: 'metric', factor: 10, label: 'cm' },
  mm: { dimension: 'length', system: 'metric', factor: 1, label: 'mm' },

  // Temperature. Converted by formula rather than by factor, and never scaled.
  f: { dimension: 'temperature', system: 'us', label: '°F' },
  c: { dimension: 'temperature', system: 'metric', label: '°C' },

  // Countable units: they scale with the servings, and there is no other system to put
  // them in.
  piece: { dimension: 'count', system: null, label: 'piece', plural: 'pieces' },
  clove: { dimension: 'count', system: null, label: 'clove', plural: 'cloves' },
  slice: { dimension: 'count', system: null, label: 'slice', plural: 'slices' },
  can: { dimension: 'count', system: null, label: 'can', plural: 'cans' },
  pinch: { dimension: 'count', system: null, label: 'pinch', plural: 'pinches' },
  dash: { dimension: 'count', system: null, label: 'dash', plural: 'dashes' },
  drop: { dimension: 'count', system: null, label: 'drop', plural: 'drops' },
  stalk: { dimension: 'count', system: null, label: 'stalk', plural: 'stalks' },
  sprig: { dimension: 'count', system: null, label: 'sprig', plural: 'sprigs' },
  bunch: { dimension: 'count', system: null, label: 'bunch', plural: 'bunches' },
  handful: { dimension: 'count', system: null, label: 'handful', plural: 'handfuls' },
  head: { dimension: 'count', system: null, label: 'head', plural: 'heads' },
  leaf: { dimension: 'count', system: null, label: 'leaf', plural: 'leaves' },
  stick: { dimension: 'count', system: null, label: 'stick', plural: 'sticks' },
  sheet: { dimension: 'count', system: null, label: 'sheet', plural: 'sheets' },
  packet: { dimension: 'count', system: null, label: 'packet', plural: 'packets' },
}

/**
 * What a converted amount is rendered *as*, largest first. Narrower than the unit table on
 * purpose: every unit here is one a recipe would plausibly be written in, so a litre of
 * stock becomes cups rather than the technically-correct quart, and a teaspoon of metric
 * volume becomes ml rather than a fraction of a fluid ounce.
 */
const TARGETS: Record<string, string[]> = {
  'volume:us': ['cup', 'fl-oz'],
  'volume:metric': ['l', 'ml'],
  'mass:us': ['lb', 'oz'],
  'mass:metric': ['kg', 'g'],
  'length:us': ['inch'],
  'length:metric': ['cm', 'mm'],
}

/**
 * Whether an amount in this unit is part of the *yield*.
 *
 * Volumes, masses and counts are: twice the servings is twice the flour. A length is a
 * dimension rather than an amount — a 9-inch tin and a 1 cm dice don't change because more
 * people are eating — and an oven temperature certainly isn't. Those two are left exactly
 * as written, which is the only behaviour that can't mislead.
 */
function scales(def: UnitDef | undefined): boolean {
  if (!def) return true // free-text unit: assume it's an amount, because it usually is
  return def.dimension !== 'length' && def.dimension !== 'temperature'
}

const lookup = (unit: string | undefined): UnitDef | undefined =>
  unit ? UNITS[unit] : undefined

/** Whether the toggle can do anything at all to this quantity. */
export function isConvertible(quantity: Quantity): boolean {
  const def = lookup(quantity.unit)
  if (!def || def.fixed || def.system === null) return false
  return def.dimension === 'temperature' || `${def.dimension}:us` in TARGETS
}

/**
 * Re-expresses a quantity in `target`'s units, or hands it straight back when there is
 * nothing to do — already in that system, a fixed spoon measure, a count, or a unit this
 * table has never heard of.
 */
export function convert(quantity: Quantity, target: UnitSystem): Quantity {
  const def = lookup(quantity.unit)
  if (!def || def.fixed || def.system === null || def.system === target) return quantity

  if (def.dimension === 'temperature') {
    return target === 'metric'
      ? { amount: ((quantity.amount - 32) * 5) / 9, unit: 'c' }
      : { amount: (quantity.amount * 9) / 5 + 32, unit: 'f' }
  }

  const ladder = TARGETS[`${def.dimension}:${target}`]
  if (!ladder || def.factor === undefined) return quantity

  const base = quantity.amount * def.factor

  // The largest unit the amount still reads as at least one of — "0.4 l" is worse than
  // "400 ml" — falling back to the smallest when it doesn't reach even that.
  const unit =
    ladder.find((candidate) => base / (UNITS[candidate].factor ?? 1) >= 1) ??
    ladder[ladder.length - 1]

  return { amount: base / (UNITS[unit].factor ?? 1), unit }
}

/** Scales by the servings ratio, leaving anything that isn't part of the yield alone. */
export function scale(quantity: Quantity, factor: number): Quantity {
  if (factor === 1 || !scales(lookup(quantity.unit))) return quantity
  return { ...quantity, amount: quantity.amount * factor }
}

/** Vulgar fractions, which is how US measures are written and how cups are read. */
const FRACTIONS: [value: number, glyph: string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
]

/** How far off a fraction may be before a decimal is the more honest rendering. */
const FRACTION_TOLERANCE = 0.04

/**
 * "1.5" → "1½", "0.333" → "⅓", "1.37" → null.
 *
 * Scaling produces thirds and eighths constantly (a ¾-cup recipe at 1.5× is 1⅛ cups), and
 * those are exactly the numbers a cook can measure. Anything that isn't close to a kitchen
 * fraction returns null and is rendered as a decimal instead — a spurious "⅜" would be a
 * lie about precision the number doesn't have.
 */
function asFraction(value: number): string | null {
  const whole = Math.floor(value + 1e-9)
  const remainder = value - whole

  if (remainder < FRACTION_TOLERANCE) return whole > 0 ? String(whole) : null

  for (const [fraction, glyph] of FRACTIONS) {
    if (Math.abs(remainder - fraction) <= FRACTION_TOLERANCE) {
      return whole > 0 ? `${whole}${glyph}` : glyph
    }
  }

  // Close enough to the next whole number to round up to it.
  if (1 - remainder < FRACTION_TOLERANCE) return String(whole + 1)

  return null
}

/**
 * Metric amounts are read as decimals, and rounded by magnitude rather than to a fixed
 * number of places: nobody weighs out 237.3 g, and "0.05 l" should never have been litres.
 */
function roundMetric(value: number): number {
  if (value >= 1000) return Math.round(value / 10) * 10
  if (value >= 100) return Math.round(value / 5) * 5
  if (value >= 10) return Math.round(value)
  if (value >= 1) return Math.round(value * 10) / 10
  return Math.round(value * 100) / 100
}

/** Trims a float's tail without `toFixed`'s trailing zeros. */
const trim = (value: number): string => String(Math.round(value * 100) / 100)

/**
 * US measures and bare counts, to the precision a kitchen actually has.
 *
 * A fraction is tried first, because thirds are what scaling by 1.5 or ⅔ produces and an
 * eighth is not a good answer for one. Failing that the amount is snapped to the nearest
 * eighth — the finest graduation on a measuring cup — which is what turns a converted
 * "7.05 oz" into "7" rather than implying a precision no scale in the drawer has.
 *
 * Amounts below an eighth are left as decimals: snapping those would round them to nothing.
 */
function formatUsAmount(value: number): string {
  const exact = asFraction(value)
  if (exact !== null) return exact

  const snapped = Math.round(value * 8) / 8
  if (snapped === 0) return trim(value)

  return asFraction(snapped) ?? trim(snapped)
}

/** The number alone, formatted the way its unit is conventionally written. */
export function formatAmount(quantity: Quantity): string {
  const def = lookup(quantity.unit)

  // Oven temperatures are read in fives, and a fractional degree is noise.
  if (def?.dimension === 'temperature') return String(Math.round(quantity.amount / 5) * 5)

  if (def?.system === 'metric') return trim(roundMetric(quantity.amount))

  return formatUsAmount(quantity.amount)
}

/** The unit's label, inflected against the amount. A missing token renders as written. */
export function formatUnit(quantity: Quantity): string {
  const def = lookup(quantity.unit)
  if (!def) return quantity.unit ?? ''
  if (!def.plural) return def.label

  // Against the rendered figure, not the raw one: 0.98 cups displays as "1", and "1 cups"
  // would read as a bug.
  return formatAmount(quantity) === '1' ? def.label : def.plural
}

/**
 * The whole pipeline for one amount: scale by the servings ratio, convert into the chosen
 * system, render. This is the only function the UI needs, and the only place the order of
 * the two transformations is decided.
 */
export function formatQuantity(
  quantity: Quantity,
  { factor = 1, system }: { factor?: number; system: UnitSystem }
): string {
  const final = convert(scale(quantity, factor), system)
  const unit = formatUnit(final)

  // "°F" and "°C" hug the number; every other unit takes a space.
  const separator = unit.startsWith('°') ? ' ' : unit ? ' ' : ''
  return `${formatAmount(final)}${separator}${unit}`
}

/**
 * A quantity exactly as it is stored — no scaling, no conversion, only the formatting.
 *
 * This is what the *editor* shows: a row being edited has to read back what was written into
 * it, not what a reader on the other system would see. Everything a reader looks at goes
 * through `formatQuantity` instead.
 */
export function formatStoredQuantity(quantity: Quantity): string {
  const unit = formatUnit(quantity)
  return unit ? `${formatAmount(quantity)} ${unit}` : formatAmount(quantity)
}

/** A run of a step's text: either prose, or one of its quantities rendered in place. */
export interface TextSegment {
  text: string
  /** True for a segment that came from a `{n}` marker, so the UI can set it apart. */
  isQuantity: boolean
}

const MARKER = /\{(\d+)\}/g

/**
 * Splits a step's text on its `{n}` markers, substituting each one with its scaled and
 * converted amount.
 *
 * A marker with no matching quantity — or one whose amount didn't survive parsing — is left
 * as the literal text it is rather than dropped, so a miscounted step reads oddly instead
 * of silently losing an instruction's amount.
 */
export function splitQuantityText(
  text: string,
  quantities: Quantity[] | undefined,
  options: { factor?: number; system: UnitSystem }
): TextSegment[] {
  const segments: TextSegment[] = []
  let cursor = 0

  for (const match of text.matchAll(MARKER)) {
    const at = match.index
    const quantity = quantities?.[Number(match[1])]

    if (at > cursor) segments.push({ text: text.slice(cursor, at), isQuantity: false })

    if (quantity && quantity.amount > 0) {
      segments.push({ text: formatQuantity(quantity, options), isQuantity: true })
    } else {
      segments.push({ text: match[0], isQuantity: false })
    }

    cursor = at + match[0].length
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), isQuantity: false })

  return segments
}

/** Whether anything on the page would actually change if the toggle were flipped. */
export function hasConvertible(quantities: (Quantity | undefined)[]): boolean {
  return quantities.some((quantity) => quantity && isConvertible(quantity))
}

/** "90" → "1:30", matching how a habit's action-item timer is written and read. */
export const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** "45 min", "1 h 10 min" — the summary form, for a step that isn't running. */
export function formatDurationLong(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** The unit tokens the step/ingredient editors offer, grouped the way a cook thinks. */
export const UNIT_OPTIONS: { label: string; units: (string | undefined)[] }[] = [
  { label: 'Count', units: [undefined, 'piece', 'clove', 'slice', 'can', 'pinch', 'dash', 'sprig', 'bunch'] },
  { label: 'Volume (US)', units: ['tsp', 'tbsp', 'fl-oz', 'cup', 'pint', 'quart', 'bowl'] },
  { label: 'Volume (metric)', units: ['ml', 'l'] },
  { label: 'Weight', units: ['oz', 'lb', 'g', 'kg'] },
  { label: 'Other', units: ['inch', 'cm', 'f', 'c'] },
]

/** The label for a unit token in a picker, where there is no amount to inflect against. */
export function unitOptionLabel(unit: string | undefined): string {
  if (!unit) return '—'
  const def = UNITS[unit]
  return def ? def.plural ?? def.label : unit
}
