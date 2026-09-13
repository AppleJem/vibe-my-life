# Staged media: pick up to 5 files, arrange into climbs, then upload

**Status:** proposed · **Scope:** `frontend/src/components/Climbing/*`, `frontend/src/routes/_authenticated/climbing/$sessionId.tsx`, `backend/src/modules/climbing/*`

## What changes for the user

Today, adding media happens inside one climb: tap `+` on a `MediaStrip`, and the file is
compressed and uploaded immediately. That's right for "one photo for the climb I'm looking
at" and wrong for "I just got back to the car with five clips".

New flow, on the session screen, directly below **+ Add climb**:

```
[ + Add photos or clips ]              ← up to 5, nothing uploaded yet

┌─────────────────────────────────────────────┐
│ ┌────┐                                      │
│ │thumb│ IMG_4021.mov                      × │
│ └────┘  ① ② ③ ④ ⑤  N1  +                   │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ ┌────┐                                      │
│ │thumb│ IMG_4022.mov                      × │
│ └────┘  ① ② ③ ④ ⑤  N1  +                   │
└─────────────────────────────────────────────┘

  2 of 2 assigned · will add 1 new climb
  [ Confirm ]  [ Clear ]
```

- Picking files does **no** compression and **no** uploading. They sit as local previews.
- Each row has a **chip strip**: one chip per existing climb by its position (`① ② ③ …`),
  then `N1`, `N2`, … for climbs that don't exist yet, then `+` to start another new one.
  Tap a chip to assign, tap the highlighted one again to unassign. Several files can take
  the same chip.
- `×` drops a file; `Clear` drops the lot.
- **Confirm** is disabled until every file has a home. Pressing it creates any new climbs
  and then compresses and uploads the files one at a time, showing the same
  compressing/uploading bar `MediaStrip` already shows.

Climbs created this way start with **no outcome and no grade** — a nameless row you fill in
when you get to it. That requires the one backend change below.

---

## 1. The backend guard: `outcome` stops being required

`backend/src/modules/climbing/climbing.controller.ts`:

```ts
outcome: z.enum(['flashed', 'solved', 'projecting', 'attempted', 'given-up']),
```

That is the guard. A climb cannot be saved without an outcome, so a climb created purely to
hold a video is rejected at the API. Three edits:

| File | Change |
| --- | --- |
| `climbing.controller.ts` | `outcome: z.enum([…]).optional()` |
| `climbing.types.d.ts` | `Climb.outcome?: ClimbOutcome` and `SessionInput.climbs[].outcome?: …` |
| `climbing.model.ts` | `toStored`: `...(climb.outcome && { outcome: climb.outcome })` instead of the unconditional `outcome: climb.outcome` |

That last one matters — DynamoDB rejects a literal `undefined` attribute, and `toStored`
already does exactly this dance for `grade`, `description` and `posterKey`.

Mirror it on the client in `frontend/src/types/climbing.d.ts`.

### The `outcomeMeta` trap

`frontend/src/utils/climbing.ts:29`:

```ts
export const outcomeMeta = (outcome: ClimbOutcome) =>
  OUTCOMES.find((o) => o.value === outcome) ?? OUTCOMES[2]
```

`OUTCOMES[2]` is **projecting**. Today that fallback only fires on corrupt data; the moment
`outcome` can be absent it fires for every nameless climb, and a climb you have only video
of renders as a blue dot labelled *Projecting*. Wrong, and confidently wrong. Fix:

```ts
/** What a climb with no outcome yet looks like. Not in OUTCOMES — it isn't a result. */
export const UNLOGGED_META = { label: 'Not logged', dot: 'bg-zinc-600', text: 'text-zinc-500' }

export const outcomeMeta = (outcome?: ClimbOutcome) =>
  outcome ? (OUTCOMES.find((o) => o.value === outcome) ?? OUTCOMES[2]) : UNLOGGED_META
```

`ClimbRow` then needs `<option value="">Not logged</option>` first in its select, and
`patch({ outcome: e.target.value || undefined })` on change. `solveCount` and `flashCount`
compare against specific strings, so they already ignore nameless climbs correctly.

**Alternative considered:** add `'unspecified'` to the `ClimbOutcome` union instead. Keeps
`outcome` non-optional everywhere and needs no `?` in the types. Rejected because "no
outcome recorded" isn't an outcome, and it would show up in every exhaustive switch on the
union forever. Say the word if you'd rather have it.

**Frontend guard, as you asked:** the normal **+ Add climb** keeps defaulting to
`'attempted'`, so nameless climbs only ever appear via the media tray. The `Not logged`
option is still offered in the row's select — unsetting an outcome is legitimate, you might
log the clip first and decide later.

---

## 2. Sharing the upload pipeline

`MediaStrip.handleFiles` already contains the whole per-file pipeline: compress → size
check → upload → upload thumbnail → `MediaRef`. The tray needs the identical thing, so
extract it rather than copy it. New `frontend/src/utils/processMedia.ts`:

```ts
export type MediaPhase = 'queued' | 'compressing' | 'uploading'

/**
 * Compress, upload, and upload the thumbnail for one file, in that order.
 * Returns the MediaRef to store on a climb, posterKey included.
 */
export async function processMediaFile(
  file: File,
  onProgress: (phase: MediaPhase, fraction: number) => void,
  signal?: AbortSignal
): Promise<MediaRef>
```

Body is today's `handleFiles` loop body, verbatim, minus the `onChange` at the end. Both
callers keep their own UI:

- `MediaStrip` → `const ref = await processMediaFile(file, (phase, p) => update(id, { phase, progress }), signal)`
  then `onChange([...itemsRef.current, ref])`. Behaviour unchanged.
- `MediaTray` → same call, but appends into whichever climb the file was assigned to.

Also extract the ~20 lines of overlay markup (the `NN%` text, the *shrinking* caption, the
bottom progress bar) into `<MediaProgressOverlay phase progress />` in
`components/Climbing/`, since both need it and it's the part most likely to drift.

---

## 3. `MediaTray.tsx`

### State

```ts
/** A file picked but not yet uploaded. Nothing here is a MediaRef — there's no key yet. */
interface StagedFile {
  id: string
  file: File
  /** Local object URL for the thumbnail. Revoked on drop, on success, on unmount. */
  previewUrl: string
  isVideo: boolean
  /** A still pulled out locally, so an iOS preview isn't a black box. See below. */
  posterUrl: string | null
  /**
   * Where it lands on Confirm: a real climb id, or `NEW:<n>` for a climb that doesn't
   * exist yet. `null` = undecided, which blocks Confirm.
   */
  target: string | null
  phase: MediaPhase          // only meaningful while running
  progress: number
  error: string | null
}
```

Held in `MediaTray`, not in the session draft — a staged file has no `key`, so it cannot go
into `Climb.media` and must not be autosaved.

### Props

```ts
interface MediaTrayProps {
  /** Current draft climbs, for the picker's options and their display numbers. */
  climbs: Climb[]
  /** Replaces the whole array — the same call the page already makes to edit a row. */
  onChangeClimbs: (climbs: Climb[]) => void
  /** Opens climbs for editing, so a freshly created one is ready to be filled in. */
  onOpenEditing: (ids: string[]) => void
}
```

The tray keeps `climbsRef.current = climbs` (the pattern `MediaStrip` already uses) so the
upload loop always appends onto the newest array.

### Layout: one row per file, not a horizontal strip

Chips need horizontal room, and five cards side by side on a 375 px phone leaves ~70 px
each — nowhere near enough for eight chips. So the tray is a vertical list: a 56 px
thumbnail on the left, the filename and the chip strip beside it, `×` on the right. Five
rows are taller than a strip would be, but every row is scannable and the chips never
need scrolling at the ~5 climbs a session actually has.

### Picker: tappable chips, not a `<select>`

**Decided.** A native `<select>` per row was the alternative — one tap into the OS picker,
handles any number of climbs, and matches `ClimbRow`'s outcome select. Chips win here
because a session holds ~5 climbs, so the strip is short, and because assigning is then a
single tap and the *grouping is visible across rows at a glance* without opening anything.

Chip states: unselected (`bg-zinc-800 text-zinc-400`), selected (`bg-sky-400 text-zinc-950`),
and `+` (`border-dashed`) which appends a new `NEW:<n>` group and immediately assigns the
file to it. A group's chip disappears once no file points at it — no empty `N2` left
cluttering the strip.

### Why new climbs aren't created until Confirm

The `N1` chip is the synthetic id `NEW:<n>`, not a real climb. Creating the rows
immediately would be simpler, but then dropping a file — or just leaving the screen —
leaves an empty nameless climb behind for no reason. Deferring means **nothing about the
session changes until Confirm**, which is what "confirm" should mean.

### Confirm

```
1.  Bail if any file is unassigned (button is disabled, so this is belt and braces).
2.  For each NEW:<n> group present, create { id: crypto.randomUUID() } — no outcome,
    no grade — and map NEW:<n> → that id.
3.  onChangeClimbs([...climbs, ...created]); onOpenEditing(createdIds)
    → the new rows appear immediately, open for editing.
4.  Sequential upload (never parallel — a phone video saturates the connection, and one
    honest progress bar beats five fighting ones):
      for each staged file:
        processMediaFile → on success: append the ref to its climb, drop the card,
                           revoke its URLs
                        → on failure: keep the card, show the error, let them retry
                           or × it
5.  AbortController per run; a second Confirm press (or Clear) cancels it.
```

Appending on each success rather than in one batch at the end means a failure halfway
through doesn't throw away the four that already worked.

### Limits and checks

| | |
| --- | --- |
| Max 5 staged | `MAX_STAGED = 5`. Picking more takes the first five and says so; the add button disables at five. |
| Type / size | `sourceRejectionReason(file)` at pick time, so a bad file never enters the tray. Same message as today. |
| Per-climb cap | Backend allows 20 media per climb (`mediaSchema…max(20)`). Worth a client-side check on Confirm, since 5 into a climb that already has 18 would 400. |

### Video previews

A `<video>` element won't paint a frame on iOS until it plays — the reason `posterKey`
exists at all — so the tray takes a local still with the existing `posterFromVideo(file)`.
That runs against the local file and uploads nothing, so it isn't the compression step
being deferred. Fall back to the `<video>` element when it returns null.

---

## 4. Wiring into `$sessionId.tsx`

Below **+ Add climb**:

```tsx
<button onClick={addClimb} …>+ Add climb</button>

{mediaEnabled && (
  <MediaTray
    climbs={draft.climbs}
    onChangeClimbs={(climbs) => patch({ climbs })}
    onOpenEditing={(ids) => setEditingIds((cur) => new Set([...cur, ...ids]))}
  />
)}
```

`patch` already exists; `setEditingIds` already exists. Guarded on `mediaEnabled` like
`MediaStrip` is, so the tray disappears entirely when there's no bucket.

`$sessionId.tsx` is already 271 lines and the tray carries its own state, so this adds
~10 lines to the page, not 150.

---

## Files touched

| File | Change |
| --- | --- |
| `backend/src/modules/climbing/climbing.controller.ts` | `outcome` optional |
| `backend/src/modules/climbing/climbing.types.d.ts` | `outcome?` on `Climb` + `SessionInput` |
| `backend/src/modules/climbing/climbing.model.ts` | conditional spread in `toStored` |
| `frontend/src/types/climbing.d.ts` | `outcome?` on `Climb` |
| `frontend/src/utils/climbing.ts` | `UNLOGGED_META`, `outcomeMeta(outcome?)` |
| `frontend/src/components/Climbing/ClimbRow.tsx` | `Not logged` option; render nameless rows |
| `frontend/src/utils/processMedia.ts` | **new** — extracted pipeline |
| `frontend/src/components/Climbing/MediaProgressOverlay.tsx` | **new** — shared progress overlay |
| `frontend/src/components/Climbing/MediaStrip.tsx` | use the two new shared pieces |
| `frontend/src/components/Climbing/MediaTray.tsx` | **new** — the tray |
| `frontend/src/routes/_authenticated/climbing/$sessionId.tsx` | mount the tray |

## Build order

### Phase 1 — backend: `outcome` becomes optional ✅

- [x] `climbing.controller.ts` — `outcome: z.enum([…]).optional()`
- [x] `climbing.types.d.ts` — `Climb.outcome?` and `SessionInput.climbs[].outcome?`
- [x] `climbing.model.ts` — `toStored` spreads `outcome` conditionally
- [x] `pnpm --filter backend build` passes

### Phase 2 — nameless climbs render ✅

- [x] `utils/climbing.ts` — `UNLOGGED_META`; `outcomeMeta(outcome?)` returns it for `undefined`
- [x] `types/climbing.d.ts` — `Climb.outcome?`
- [x] `ClimbRow.tsx` — `Not logged` option first in the select, empty string maps to `undefined`
- [x] `ClimbRow.tsx` — read-only row shows `UNLOGGED_META.label` (never `Projecting`)
- [ ] **Manual check:** clear a climb's outcome, save, reload, it survives

### Phase 3 — extract the shared pipeline ✅

- [x] `utils/processMedia.ts` — `MediaPhase`, `isVideoFile`, `processMediaFile()`
- [x] `components/Climbing/MediaProgressOverlay.tsx` — shared progress overlay
- [x] `MediaStrip.tsx` — refactored onto both (~45 lines shorter, behaviour unchanged)
- [ ] **Manual check:** adding media from a climb row behaves exactly as before

### Phase 4 — `MediaTray` ✅

- [x] `MediaTray.tsx` — state, file input capped at 5, previews, local posters
- [x] `MediaTray.tsx` — chip strip (existing climbs, `N1`/`N2`, `+`); unused groups drop out
- [x] `MediaTray.tsx` — remove a file, Clear all, object-URL cleanup
- [x] `MediaTray.tsx` — summary line + Confirm/Cancel
- [x] `$sessionId.tsx` — mounted below **+ Add climb**, gated on `mediaEnabled`

### Phase 5 — Confirm actually runs ✅

- [x] Materialise each `NEW:<n>` group into a real climb, map synthetic → real id
- [x] `onChangeClimbs([...climbs, ...created])` + `onOpenEditing(createdIds)`
- [x] Retarget staged files onto the new climbs, so a retry can't duplicate them
- [x] Sequential upload queue; on success append the ref to its climb and drop the row
- [x] On failure keep the row with its error so Confirm can be pressed again
- [x] `AbortController` for the run; Cancel aborts it, unstarted rows stay staged
- [x] Per-climb 20-media cap checked before starting (backend would 400)

### Remaining

- [ ] **Manual check:** stage 3 files, 2 onto an existing climb and 1 onto `N1`, Confirm —
      one new nameless row appears with its clip, the two join the existing climb
- [ ] **Manual check:** kill the network mid-upload; the failed rows stay with an error and
      Confirm again finishes just those

## Decisions

1. **Picker = tappable chips.** (A native `<select>` per row was the alternative.) A
   session holds ~5 climbs, so the strip stays short, assigning is one tap, and the
   grouping reads across rows without opening anything.
2. **The per-climb `+` keeps uploading immediately.** `MediaStrip`'s existing behaviour is
   unchanged — it's the fast path for one photo on the climb you're look at, and routing it
   through the tray would mean scrolling to the bottom of the page to press Confirm. Both
   paths share `processMediaFile`, so there's no duplicated upload logic.

## Open questions

3. **Retry on failure?** Plan leaves failed rows in the tray so Confirm can be pressed
   again for just those. Alternative: auto-retry once, then give up.
4. **Max 5 — per batch or per session?** Assumed per batch (5 staged at once, confirm, add
   5 more). The backend's 20-per-climb cap is the only hard ceiling either way.
5. **Should unassigned block Confirm?** Assumed yes, with a "2 of 3 assigned" hint on the
   button. The alternative — leaving unassigned files in the tray — is more forgiving but
   makes Confirm's result harder to predict.
