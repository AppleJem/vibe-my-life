export interface LabelPos {
  side: 'L' | 'R'
  /** Vertical centre of the two-line label, after de-collision. */
  y: number
}

/**
 * Where each slice's callout label sits.
 *
 * Labels are placed at their slice's mid-angle, then pushed apart vertically so
 * none overlap — a small month has a slice at 1% whose neighbours would
 * otherwise print on top of it. Labels keep their reading order down each side,
 * so a label never crosses its neighbour's leader line.
 *
 * Angles follow the chart's `startAngle={90} endAngle={-270}` (clockwise from
 * twelve o'clock) with `paddingAngle` degrees of gap between slices.
 */
/** Mid-angle of each slice, in degrees, clockwise from twelve o'clock. */
function midAngles(percents: number[], paddingAngle: number): number[] {
  const sweep = 360 - paddingAngle * percents.length
  let angle = 90

  return percents.map((percent) => {
    const span = (percent / 100) * sweep
    const mid = angle - span / 2
    angle -= span + paddingAngle
    return mid
  })
}

export function layoutLabels(
  percents: number[],
  cy: number,
  radius: number,
  lineHeight: number,
  paddingAngle: number,
  height: number
): LabelPos[] {
  if (percents.length === 0) return []

  const positions = midAngles(percents, paddingAngle).map((mid, i) => {
    const rad = (mid * Math.PI) / 180
    return {
      order: i,
      side: (Math.cos(rad) >= 0 ? 'R' : 'L') as 'L' | 'R',
      y: cy - radius * Math.sin(rad),
    }
  })

  const half = lineHeight / 2

  for (const side of ['L', 'R'] as const) {
    const column = positions.filter((p) => p.side === side).sort((a, b) => a.y - b.y)

    // Push down to open up the minimum gap, then push back up off the bottom
    // edge. Two passes settle any column that fits at all.
    for (let i = 1; i < column.length; i++) {
      column[i].y = Math.max(column[i].y, column[i - 1].y + lineHeight)
    }
    for (let i = column.length - 1; i >= 0; i--) {
      const ceiling = i === column.length - 1 ? height - half : column[i + 1].y - lineHeight
      column[i].y = Math.min(column[i].y, ceiling)
    }
    for (let i = 0; i < column.length; i++) {
      const floor = i === 0 ? half : column[i - 1].y + lineHeight
      column[i].y = Math.max(column[i].y, floor)
    }
  }

  return positions
    .sort((a, b) => a.order - b.order)
    .map(({ side, y }) => ({ side, y }))
}

/**
 * Enough vertical room for the busiest column, within sane bounds.
 *
 * The two sides are rarely balanced: slices are ordered by spend, so the right
 * half of the ring is consumed by the first ~50% of the money and a long tail
 * of small categories all stacks up the left. Sizing off `count / 2` pushes
 * labels off the canvas, so measure the actual busiest side.
 */
export function donutHeight(percents: number[], lineHeight: number, paddingAngle: number): number {
  if (percents.length === 0) return 300

  let right = 0
  for (const mid of midAngles(percents, paddingAngle)) {
    if (Math.cos((mid * Math.PI) / 180) >= 0) right++
  }
  const busiest = Math.max(right, percents.length - right)

  return Math.min(520, Math.max(300, busiest * lineHeight + 60))
}
