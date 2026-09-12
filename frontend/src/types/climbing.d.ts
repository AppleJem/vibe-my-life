/**
 * Mirrors `backend/src/modules/climbing/climbing.types.d.ts`.
 *
 * A session is a date and a place; the climbs inside it are embedded, so a session comes
 * back whole and a save sends it whole.
 */

/**
 * How a climb went. Deliberately not a boolean: "projecting" and "given up" are the two
 * ends of the same unfinished climb, and the difference between them is the point.
 */
export type ClimbOutcome = 'flashed' | 'solved' | 'projecting' | 'attempted' | 'given-up'

/**
 * Whether this session's grades are numbers to step through (V4, V5) or short strings to
 * type (6b+, 5.11c). It picks the editor widget and nothing else — the grade is stored as
 * text either way, so flipping the toggle never rewrites data.
 */
export type GradeKind = 'integer' | 'string'

/**
 * A photo or a clip in S3, referenced by object key. Never a URL: every URL the app hands
 * out is presigned and expires within the hour, so one baked into the record would be a
 * dead link by the next visit. `useMediaUrls` turns keys into URLs at render time.
 */
export interface MediaRef {
  id: string
  key: string
  kind: 'image' | 'video'
  contentType: string
}

export interface Climb {
  id: string
  outcome: ClimbOutcome
  /** Text in both grade kinds — an integer session holds "5", not 5. */
  grade?: string
  description?: string
  media?: MediaRef[]
}

export interface ClimbingSession {
  id: string
  /** `YYYY-MM-DD`, local. */
  date: string
  location: string
  gradeSystem: string
  gradeKind: GradeKind
  climbs: Climb[]
  createdAt: string
  updatedAt: string
}

/** Ids are assigned by the backend, so a row the form just added can be saved as-is. */
export interface SessionInput {
  date: string
  location: string
  gradeSystem: string
  gradeKind: GradeKind
  climbs: {
    id?: string
    outcome: ClimbOutcome
    grade?: string
    description?: string
    media?: MediaRef[]
  }[]
}
