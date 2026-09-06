/**
 * Categorical palette for the planning donut — the muted counterpart to
 * `chartColors.ts`.
 *
 * Muted was the brief, and "muted" here means measured, not eyeballed: OKLCH chroma runs
 * 0.105–0.131, against the category palette's 0.128–0.180. The loud end of the spectrum is
 * simply gone. The floor is not lower because below C 0.10 a hue stops reading as a hue at
 * all and turns grey. What the lost saturation costs in separation is paid back in
 * lightness, which is why this palette still measures *better* than the vivid one.
 *
 * Validated as a set against the `bg-zinc-900` card surface (#18181b):
 *
 *   lightness band       all 8 inside L 0.48–0.67          PASS
 *   chroma floor         all 8 >= 0.10                     PASS
 *   CVD separation       worst adjacent ΔE 10.3 (protan)   PASS  (category palette: 8.4)
 *   normal-vision floor  worst adjacent ΔE 19.2            PASS
 *   contrast vs surface  all 8 >= 3:1                      PASS
 *
 * The order is the safety mechanism, not decoration. It was chosen so that **every**
 * ring wraparound holds: for any slice count from 2 to 8 the last slice touches the
 * first, and each of those seven pairs clears both gates on its own (worst ΔE 13.8
 * protan / 18.7 normal). That is why — unlike `assignSliceColors` — nothing below needs
 * a special case. Do not reorder, and do not add a ninth hue: past eight there is no hue
 * left that isn't within confusion distance of one already on screen.
 */
export const HOLDING_SLOTS = [
  '#a49620', // 1 olive
  '#5563b6', // 2 indigo
  '#c573b2', // 3 orchid
  '#057f61', // 4 pine
  '#3c9cdc', // 5 sky
  '#a55033', // 6 rust
  '#06a2ae', // 7 teal
  '#b24f66', // 8 rose
] as const

/**
 * Colours for `n` donut slices, in slice order (which is value descending).
 *
 * Past eight slices the hues cycle. A repeated hue is always eight positions away in the
 * ring, so a hue never touches its own twin — except at n % 8 === 1 (9, 17, …), where
 * cycling puts olive back at the end, against the olive that opens the ring. That one
 * case takes sky instead, which is the only slot that clears both of its new neighbours
 * comfortably: sky↔olive (the wrap) ΔE 17.3 protan, sky↔rose (its predecessor) 24.4.
 * Pine and orchid were measured here too and both fail — pine sits ΔE 4.1 from rose.
 *
 * Colour is no longer unique past eight, which is why every slice is also identified by
 * name and swatch in the list below the chart.
 */
export function assignHoldingColors(n: number): string[] {
  const slots = Array.from({ length: n }, (_, i) => i % HOLDING_SLOTS.length)

  if (n > 1 && n % HOLDING_SLOTS.length === 1) {
    slots[n - 1] = 4 // sky
  }

  return slots.map((slot) => HOLDING_SLOTS[slot])
}
