/**
 * Categorical palette for the category donut. These are the dark steps of an
 * eight-hue palette validated as a set against the `bg-zinc-900` card surface
 * (#18181b): every slot clears the lightness band, the chroma floor, adjacent
 * colour-vision-deficiency separation, the normal-vision floor, and 3:1 contrast.
 *
 * The order is the safety mechanism, not decoration — it was chosen so that
 * neighbouring slots stay far enough apart under protanopia/deuteranopia. Do not
 * reorder, and do not add a ninth hue: past eight there is no hue left that isn't
 * within confusion distance of one already on screen.
 */
export const SERIES_SLOTS = [
  '#3987e5', // 1 blue
  '#d95926', // 2 orange
  '#199e70', // 3 aqua
  '#c98500', // 4 yellow
  '#d55181', // 5 magenta
  '#008300', // 6 green
  '#9085e9', // 7 violet
  '#e66767', // 8 red
] as const

const GREEN = 5
const RED = 7

/**
 * Colours for `n` donut slices, in slice order (which is spend descending).
 *
 * A donut is a ring, so the last slice touches the first — an adjacency the
 * linear palette order never covers. Two cases break there and are corrected
 * below; the measured ΔE figures are why, so please don't "tidy" them away:
 *
 * - n % 8 === 7 (7, 15, 23, …): violet lands against blue — normal-vision ΔE 9.8,
 *   protan ΔE 1.9. Both are hard failures (the floors are 15 and 8), so the last
 *   slice takes red instead: red↔green 8.6, red↔blue 19.2.
 * - n % 8 === 1 (9, 17, …): cycling puts blue back at the end, touching the blue
 *   at the start. The last slice takes green: green↔red 8.6, green↔blue 29.9.
 *
 * Past eight slices the hues cycle. A repeated hue is always eight positions
 * away in the ring, so a hue never touches its own twin — but colour is no
 * longer unique, which is why every slice is also identified by name and swatch
 * in the list below the chart.
 */
export function assignSliceColors(n: number): string[] {
  const slots = Array.from({ length: n }, (_, i) => i % SERIES_SLOTS.length)

  if (n % SERIES_SLOTS.length === 7) {
    slots[n - 1] = RED
  } else if (n > 1 && n % SERIES_SLOTS.length === 1) {
    slots[n - 1] = GREEN
  }

  return slots.map((slot) => SERIES_SLOTS[slot])
}
