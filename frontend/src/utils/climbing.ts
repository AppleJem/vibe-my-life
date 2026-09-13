import type { Climb, ClimbOutcome, ClimbingSession } from '../types/climbing'

/**
 * The grading systems the picker offers. Not exhaustive and not meant to be — the gym
 * scales at the end of the list are here because they're the ones actually climbed on, and
 * the picker's "Custom…" option covers everything else.
 */
export const GRADE_SYSTEMS = [
  'V',
  'French Sport',
  'YDS',
  'Font',
  'BP',
  'B+',
  'BFF',
  'Fitbloc',
  'Climba',
  'Upwall',
] as const

export const OUTCOMES: { value: ClimbOutcome; label: string; dot: string; text: string }[] = [
  { value: 'flashed', label: 'Flashed', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  { value: 'solved', label: 'Solved', dot: 'bg-green-400', text: 'text-green-400' },
  { value: 'projecting', label: 'Projecting', dot: 'bg-sky-400', text: 'text-sky-400' },
  { value: 'attempted', label: 'Attempted', dot: 'bg-amber-400', text: 'text-amber-400' },
  { value: 'given-up', label: 'Given up', dot: 'bg-zinc-500', text: 'text-zinc-500' },
]

export const outcomeMeta = (outcome: ClimbOutcome) =>
  OUTCOMES.find((o) => o.value === outcome) ?? OUTCOMES[2]

/** Today as `YYYY-MM-DD` in local time — never `toISOString()`, which is UTC and off by a day. */
export function todayStr(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** `YYYY-MM-DD` shifted by whole days, staying in local time. */
export function addDays(date: string, delta: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(year, month - 1, day + delta)
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const d = String(shifted.getDate()).padStart(2, '0')
  return `${shifted.getFullYear()}-${m}-${d}`
}

/** "Mon 3 Feb" — enough to place a session without the year most of the time. */
export function formatSessionDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Which day of the week a `YYYY-MM-DD` falls on, 0 = Sunday. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

export interface ActivityCell {
  date: string
  climbCount: number
  sessionIds: string[]
  /** 0–4, driving the shade. */
  level: number
}

/**
 * Buckets, not a linear scale. A linear one would make an ordinary six-climb evening look
 * identical to a two-climb one after a single monster session stretched the range; fixed
 * thresholds keep a shade meaning the same thing from one month to the next.
 */
function levelFor(climbCount: number): number {
  if (climbCount === 0) return 0
  if (climbCount <= 2) return 1
  if (climbCount <= 5) return 2
  if (climbCount <= 9) return 3
  return 4
}

/**
 * A GitHub-style contribution grid: 7 rows (Sun–Sat) × N columns (weeks).
 * Days with no session are present and empty rather than skipped, because the gaps
 * are what the picture is about.
 *
 * The grid always starts on a Sunday and the last column ends on a Saturday,
 * so the day-of-week labels stay consistent. The grid includes the current week.
 */
export function buildActivityGrid(
  sessions: ClimbingSession[],
  columns = 16,
): ActivityCell[] {
  const byDate = new Map<string, { climbCount: number; sessionIds: string[] }>()

  for (const session of sessions) {
    const entry = byDate.get(session.date) ?? { climbCount: 0, sessionIds: [] }
    entry.climbCount += session.climbs.length
    entry.sessionIds.push(session.id)
    byDate.set(session.date, entry)
  }

  const today = todayStr()
  const todayWeekday = weekdayOf(today) // 0 = Sunday

  // Start from the most recent Sunday (beginning of current week).
  // If today is Sunday, this is today; otherwise go back to last Sunday.
  const currentWeekStart = addDays(today, -todayWeekday)

  // Go back (columns - 1) weeks to get the first column's start.
  const startDate = addDays(currentWeekStart, -(columns - 1) * 7)

  const totalDays = columns * 7

  return Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(startDate, i)
    const entry = byDate.get(date)
    const climbCount = entry?.climbCount ?? 0
    const attended = entry !== undefined

    return {
      date,
      climbCount,
      sessionIds: entry?.sessionIds ?? [],
      level: attended ? Math.max(1, levelFor(climbCount)) : 0,
    }
  })
}

/** Tailwind classes per level, sky like the rest of the app. */
export const ACTIVITY_SHADES = [
  'bg-zinc-800/70',
  'bg-sky-500/25',
  'bg-sky-500/45',
  'bg-sky-500/70',
  'bg-sky-400',
]

/**
 * Steps an integer grade. The stored value is text in both grade kinds, so this parses,
 * clamps at zero, and hands text back — a field holding "V4" or an empty string steps from
 * the number it contains, or from zero when it contains none.
 */
export function stepGrade(current: string | undefined, delta: number): string {
  const parsed = parseInt((current ?? '').replace(/[^\d-]/g, ''), 10)
  const base = Number.isFinite(parsed) ? parsed : 0
  return String(Math.max(0, base + delta))
}

/** How many climbs went clean, for the one-line summary on a session row. */
export const flashCount = (climbs: Climb[]) =>
  climbs.filter((climb) => climb.outcome === 'flashed').length

export const solveCount = (climbs: Climb[]) =>
  climbs.filter((climb) => climb.outcome === 'solved' || climb.outcome === 'flashed').length
/** A grade as it should read on screen: "V4", "6b+" — the system prefixed only when short. */
export function formatGrade(grade: string, gradeSystem: string, kind: string): string {
  if (!grade) return ''
  // "V" and "B+" read as a prefix; "French Sport" does not, and the grade stands alone.
  const prefixable = kind === 'integer' && gradeSystem.length <= 3
  return prefixable ? `${gradeSystem}${grade}` : grade
}
