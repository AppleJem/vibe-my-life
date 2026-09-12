/**
 * Climbing lives in its own table (`vibe-my-life-climbing`), keyed the way the other apps
 * are: `PK = USER#<userId>`, with the sort key discriminating the item shapes.
 *
 *   Session  SK = SESSION#<sessionId>
 *
 * A session is one item — its climbs are embedded rather than stored as rows of their own.
 * The session screen reads and writes the whole thing on every save, a session is small
 * (tens of climbs at most), and embedding is what makes a save atomic.
 */

/**
 * How a climb went. Deliberately not a boolean: "projecting" and "given up" are the two
 * ends of the same unfinished climb, and the difference between them is the whole point
 * of writing it down.
 */
export type ClimbOutcome = 'flashed' | 'solved' | 'projecting' | 'attempted' | 'given-up'

/**
 * Whether this session's grades are numbers to step through (V4, V5) or short strings to
 * type (6b+, 5.11c). It picks the editor widget and nothing else — the grade itself is
 * stored as text either way, so flipping the toggle never rewrites data.
 */
export type GradeKind = 'integer' | 'string'

/**
 * A photo or a clip, stored in S3 and referenced by object key. Never a URL: every URL the
 * app hands out is presigned and short-lived, so a URL baked into the record would be a
 * dead link within the hour.
 */
export interface MediaRef {
  id: string
  /** `users/<userId>/climbing/<uuid>.<ext>` — the prefix is also the access check. */
  key: string
  kind: 'image' | 'video'
  contentType: string
}

export interface Climb {
  /** Stable across saves, so reordering doesn't make a row look like a different one. */
  id: string
  outcome: ClimbOutcome
  /**
   * Held as text in both grade kinds. An integer-graded session stores "5", not 5 — which
   * keeps one field, one validation, and no migration when a session switches systems
   * halfway through.
   */
  grade?: string
  description?: string
  media?: MediaRef[]
}

export interface ClimbingSession {
  id: string
  /** `YYYY-MM-DD`, local to wherever the climbing happened. */
  date: string
  location: string
  /** One of the known systems, or whatever the gym calls its own scale. */
  gradeSystem: string
  gradeKind: GradeKind
  climbs: Climb[]
  createdAt: string
  updatedAt: string
}

/** Ids are assigned by the model, so a client-side draft can be saved as-is. */
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
    media?: { id?: string; key: string; kind: 'image' | 'video'; contentType: string }[]
  }[]
}

/** A save replaces the whole session — there is no field-by-field patch worth the ambiguity. */
export type UpdateSessionInput = SessionInput
