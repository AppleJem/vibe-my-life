/**
 * The canonical unit vocabulary a parsed recipe is normalised into.
 *
 * Only the tokens matter here — the conversion factors live on the client, which is the
 * only place that converts. The server's job is narrower: turn whatever the LLM wrote
 * ("tablespoons", "Tbsp.", "fluid ounce") into the one spelling the client knows how to
 * look up, and leave anything it doesn't recognise verbatim.
 *
 * Keep this list in step with `frontend/src/utils/units.ts`. A token here with no entry
 * there degrades to a free-text unit: it still scales with the servings, it just won't
 * convert — which is exactly the behaviour an unrecognised unit gets anyway, so the two
 * drifting apart is a missed feature rather than a bug.
 */

/** Canonical token → every spelling that should collapse into it. */
const ALIASES: Record<string, string[]> = {
  // Volume, US. `tsp` and `tbsp` are deliberately never converted — see the client's
  // `FIXED` flag — but they are still normalised, and still scale.
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'],
  tbsp: ['tbsp', 'tbsps', 'tablespoon', 'tablespoons', 'tbl', 'tbs', 'T'],
  'fl-oz': ['fl oz', 'floz', 'fl-oz', 'fluid ounce', 'fluid ounces', 'fl. oz.'],
  cup: ['cup', 'cups', 'c'],
  pint: ['pint', 'pints', 'pt'],
  quart: ['quart', 'quarts', 'qt'],
  gallon: ['gallon', 'gallons', 'gal'],
  // Not a standard measure anywhere, but recipes written for a household use it, and it
  // reads as a volume. Treated as one, at two cups.
  bowl: ['bowl', 'bowls'],

  // Volume, metric
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'cc'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],

  // Mass, US
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],

  // Mass, metric
  g: ['g', 'gram', 'grams', 'gramme', 'grammes'],
  kg: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms'],

  // Length — pan sizes and knife work. Scales with nothing; see the client.
  inch: ['inch', 'inches', 'in', '"'],
  cm: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'],
  mm: ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'],

  // Temperature — oven and oil temperatures, which convert but never scale.
  f: ['f', '°f', 'fahrenheit', 'degrees f', 'deg f'],
  c: ['c', '°c', 'celsius', 'centigrade', 'degrees c', 'deg c'],

  // Time. A duration is never an amount of *food*, so these exist only to be recognised and
  // stripped back into prose — see `inlineTimeQuantities` in the parser. A step's real timing
  // lives in `durationSeconds`, which is not a quantity and does not scale.
  second: ['second', 'seconds', 'sec', 'secs'],
  minute: ['minute', 'minutes', 'min', 'mins'],
  hour: ['hour', 'hours', 'hr', 'hrs'],

  // Countable units: they scale, but there is no other system to express them in.
  piece: ['piece', 'pieces', 'pc', 'pcs'],
  clove: ['clove', 'cloves'],
  slice: ['slice', 'slices'],
  can: ['can', 'cans', 'tin', 'tins'],
  pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'],
  drop: ['drop', 'drops'],
  stalk: ['stalk', 'stalks'],
  sprig: ['sprig', 'sprigs'],
  bunch: ['bunch', 'bunches'],
  handful: ['handful', 'handfuls'],
  head: ['head', 'heads'],
  leaf: ['leaf', 'leaves'],
  stick: ['stick', 'sticks'],
  sheet: ['sheet', 'sheets'],
  packet: ['packet', 'packets', 'pack', 'packs', 'sachet', 'sachets'],
}

/**
 * Built once. `T` vs `t` for tablespoon vs teaspoon is a real convention, so the lookup
 * tries the raw spelling before the lowercased one — everything else is case-insensitive.
 */
const EXACT = new Map<string, string>()
const LOWER = new Map<string, string>()

for (const [canonical, spellings] of Object.entries(ALIASES)) {
  for (const spelling of spellings) {
    EXACT.set(spelling, canonical)
    // First spelling wins on collision, so `t`/`T` resolve by case above and the
    // lowercase fallback sends a bare `t` to teaspoon rather than tablespoon.
    if (!LOWER.has(spelling.toLowerCase())) LOWER.set(spelling.toLowerCase(), canonical)
  }
}

/**
 * Durations, which must never survive as quantities: a quantity scales with the servings, and
 * "simmer for 3 minutes" becoming "simmer for 6 minutes" when you cook for twice as many is
 * worse than not extracting it at all.
 */
export const TIME_UNITS = new Set(['second', 'minute', 'hour'])

/** The tokens this module can produce — what the client's table is expected to cover. */
export const CANONICAL_UNITS = Object.keys(ALIASES)

/**
 * Every spelling that collapses into a canonical token. Used to spot a unit the model wrote
 * *twice* — once as a marker's unit and again as a word right after it — which would
 * otherwise render as "200 °F F".
 */
export function unitSpellings(canonical: string): string[] {
  return ALIASES[canonical] ?? []
}

/**
 * "Tablespoons" → "tbsp". Returns the input trimmed when nothing matches: a unit the
 * client can't look up is rendered as written and scaled but not converted, which beats
 * dropping "knob" off a knob of butter.
 */
export function normaliseUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined

  const trimmed = unit.trim()
  if (!trimmed) return undefined

  // Trailing punctuation is how abbreviations are usually written ("Tbsp.", "oz.").
  const bare = trimmed.replace(/[.\s]+$/, '')

  return EXACT.get(bare) ?? LOWER.get(bare.toLowerCase()) ?? bare
}
