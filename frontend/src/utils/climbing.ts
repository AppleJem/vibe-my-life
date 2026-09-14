import type { Climb, ClimbOutcome, ClimbingSession } from '../types/climbing'
import type { Habit } from '../types/habit'

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

/** The presentational half of an outcome. `OUTCOMES` carries a `value` too; this is the rest. */
export type OutcomeMeta = { label: string; dot: string; text: string }

/**
 * How a climb with no outcome recorded yet reads.
 *
 * Deliberately not a member of `OUTCOMES`: that list is the set of things a climb can be
 * *judged* as, and this is the absence of a judgement. Keeping it out means it can never
 * be offered as something to pick — only as something to clear back to.
 */
export const UNLOGGED_META: OutcomeMeta = {
  label: 'Not logged',
  dot: 'bg-zinc-600',
  text: 'text-zinc-500',
}

/**
 * Falls back to `OUTCOMES[2]` (projecting) for a value it doesn't recognise, which is
 * corruption rather than absence — an unrecognised outcome is still one somebody chose.
 * Absence gets `UNLOGGED_META` instead, and must: reading a nameless climb as "projecting"
 * would state a result nobody recorded.
 */
export const outcomeMeta = (outcome?: ClimbOutcome): OutcomeMeta =>
  outcome ? OUTCOMES.find((o) => o.value === outcome) ?? OUTCOMES[2] : UNLOGGED_META

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

/** The number of week columns the calendar shows. Also sizes the training fetch window. */
export const ACTIVITY_COLUMNS = 16

/** What a day holds. Picks the cell's hue; intensity is separate. */
export type ActivityKind = 'none' | 'climb' | 'training' | 'both'

export interface ActivityCell {
  date: string
  climbCount: number
  sessionIds: string[]
  /** Training habits completed that day, one per completion. */
  trainingCount: number
  /** Climbing, training, both, or nothing — drives which palette the shade comes from. */
  kind: ActivityKind
  /** 0–4 combined intensity. 0 only when `kind` is `'none'`. */
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
 * Training buckets: how many training habits were completed. The ceiling is low because
 * the set is small — four habits in a day is a full session, not a warm-up.
 */
function levelForTraining(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

/**
 * A GitHub-style contribution grid: 7 rows (Sun–Sat) × N columns (weeks).
 * Days with no session are present and empty rather than skipped, because the gaps
 * are what the picture is about.
 *
 * The grid always starts on a Sunday and the last column ends on a Saturday,
 * so the day-of-week labels stay consistent. The grid includes the current week.
 *
 * A day's `kind` is decided by what is present, and `level` by how much: the two sides are
 * graded on their own scales and summed, so a both-day reads as the effort of the climb and
 * the training together rather than of the larger of the two.
 */
export function buildActivityGrid(
  sessions: ClimbingSession[],
  trainingByDate: ReadonlyMap<string, number> = new Map(),
  columns = ACTIVITY_COLUMNS,
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
    const trainingCount = trainingByDate.get(date) ?? 0

    const hasClimb = entry !== undefined
    const hasTraining = trainingCount > 0
    const kind: ActivityKind = hasClimb
      ? hasTraining
        ? 'both'
        : 'climb'
      : hasTraining
        ? 'training'
        : 'none'

    // A session with no climbs logged yet still counts as being at the wall.
    const climbLevel = hasClimb ? Math.max(1, levelFor(climbCount)) : 0
    const level = Math.min(4, climbLevel + levelForTraining(trainingCount))

    return {
      date,
      climbCount,
      sessionIds: entry?.sessionIds ?? [],
      trainingCount,
      kind,
      level,
    }
  })
}

/** The empty cell, shared by every palette at level 0. */
const EMPTY_SHADE = 'bg-zinc-800/70'

/** One palette per hue, indexed by the 0–4 level. */
export const CLIMB_SHADES = [
  EMPTY_SHADE,
  'bg-sky-500/30',
  'bg-sky-500/50',
  'bg-sky-500/75',
  'bg-sky-400',
] as const

export const TRAINING_SHADES = [
  EMPTY_SHADE,
  'bg-emerald-500/30',
  'bg-emerald-500/50',
  'bg-emerald-500/75',
  'bg-emerald-400',
] as const

export const BOTH_SHADES = [
  EMPTY_SHADE,
  'bg-fuchsia-500/30',
  'bg-fuchsia-500/50',
  'bg-fuchsia-500/75',
  'bg-fuchsia-400',
] as const

/** The Tailwind class for a cell: hue by kind, darkness by combined level. */
export function activityShade(kind: ActivityKind, level: number): string {
  const palette =
    kind === 'training' ? TRAINING_SHADES : kind === 'both' ? BOTH_SHADES : CLIMB_SHADES
  return palette[level] ?? EMPTY_SHADE
}

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

/** habitId → epoch ms of its last click. Read only by the training strip's ordering. */
export const TRAINING_RECENCY_KEY = 'climbing:training:recent'

/**
 * The training strip's order: habits not yet done today first, then — within each
 * partition — the ones clicked most recently, then alphabetical as a stable tiebreak.
 *
 * `recency` maps habit id to the epoch ms of its last click and comes from localStorage,
 * so it is deliberately untrusted: a missing entry reads as `0`, which sorts last rather
 * than throwing. `today` is passed in rather than read from the clock, the same discipline
 * as `utils/habit.ts`, so the ordering is checkable.
 */
export function sortTrainingHabits(
  habits: Habit[],
  recency: Record<string, number>,
  today: string
): Habit[] {
  const isDone = (habit: Habit) => habit.lastCompletedDate === today

  return [...habits].sort((a, b) => {
    const doneDiff = Number(isDone(a)) - Number(isDone(b))
    if (doneDiff !== 0) return doneDiff

    const recencyDiff = (recency[b.id] ?? 0) - (recency[a.id] ?? 0)
    if (recencyDiff !== 0) return recencyDiff

    return a.name.localeCompare(b.name)
  })
}
/** A grade as it should read on screen: "V4", "6b+" — the system prefixed only when short. */
export function formatGrade(grade: string, gradeSystem: string, kind: string): string {
  if (!grade) return ''
  // "V" and "B+" read as a prefix; "French Sport" does not, and the grade stands alone.
  const prefixable = kind === 'integer' && gradeSystem.length <= 3
  return prefixable ? `${gradeSystem}${grade}` : grade
}
