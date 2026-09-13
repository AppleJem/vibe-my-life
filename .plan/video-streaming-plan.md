# Climbing clips: chop them up and stream them (HLS)

**Status:** proposed · **Scope:** `backend/src/modules/media`, `frontend/src/components/Climbing`, `frontend/src/utils/compressVideo.ts`, Railway build config

## The complaint

Open a clip in the full-screen viewer and it behaves as though the whole file has to land
before anything plays. A 50–100 MB clip on mobile data is a long wait.

The chopping technique is **HLS**: the video is cut into ~4-second segments plus a text
playlist (`index.m3u8`) that lists them. The player fetches a few segments, starts playing,
and keeps fetching a little ahead of the playhead. Nothing you never watch is ever
downloaded, and — the part that actually matters on a bad connection — you can publish
several renditions and let the player step down instead of stalling.

This document answers the three questions, then proposes a build order. Short version:

| Question | Answer |
| --- | --- |
| 1. What format, and is it choppable? | Compressed output is **always MP4 / H.264 Main / AAC with `moov` at the front** — already choppable, and already progressive. Clips that *skip* compression are **whatever the phone produced** (iPhone `.mov`, HEVC, `moov` at the end) — **that is the case that has to download in full**. |
| 2. ffmpeg on the server? | Yes, and it should be. Runs as a child process from Express; no Express-specific integration needed. On Railway, install it with `backend/railpack.json` → `deploy.aptPackages: ["ffmpeg"]` (Railway now builds with **Railpack**, not Nixpacks). |
| 3. Player + buffering? | Today it's a bare `<video src>`. That already streams progressively. For HLS: **hls.js** on Chrome/Firefox, **native** `<video src>` on Safari. Buffer ~10 s / ~15 MB steady-state; first paint costs one segment (~1.5 MB). |

**The finding worth acting on first:** a large share of the pain is probably not a missing
HLS pipeline — it's clips that skipped compression. Phase 0 is a few hours and may fix most
of it. HLS is the durable fix and is still worth building, but it does not have to be first.

---

## 1. What are we compressing into, and is it choppable?

### What the client produces

`frontend/src/utils/compressVideo.ts` demuxes with mp4box, decodes with WebCodecs, draws
scaled to an `OffscreenCanvas`, re-encodes with the device's hardware encoder, and remuxes
with `mp4-muxer`. Every clip that goes through it comes out as:

| | |
| --- | --- |
| Container | MP4 |
| Video | H.264, `avc1.4d0028` (Main profile, level 4.0), ≤1920 px long edge, 3 Mbps, 30 fps, keyframe every 60 frames (2 s), no B-frames (`latencyMode: 'realtime'`) |
| Audio | AAC-LC, copied through unchanged when the source is AAC |
| Metadata placement | `fastStart: 'in-memory'` → **`moov` at the front** |

That last row is the important one. mp4-muxer's own docs: *"Use `'in-memory'` to produce a
file with Fast Start… Placing metadata at the start of the file is known as Fast Start,
which results in better playback"*. It is already set in `compressVideo.ts`.

So **compressed clips are already progressive**: a player can read the `moov`, start
playing, and range-request the rest. HLS packaging of them is also trivial — H.264 + AAC in
MP4 can be repackaged with `ffmpeg -c copy`, no re-encode, in about a second.

### When compression is skipped — and why that's the real problem

`compressVideo` returns the **original file untouched** in every one of these cases:

1. `file.size < SKIP_BELOW_BYTES` (8 MB) — harmless, the file is small.
2. `canCompressVideo()` false — only checks `typeof VideoEncoder !== 'undefined'`.
3. `VideoEncoder.isConfigSupported({ codec: 'avc1.4d0028', … })` → `supported: false`.
4. Any throw, or the 5-minute timeout.

**Case 3 is the one that bites, and it bites on iPhones.** WebCodecs on iOS Safari is
*partial* from 16.4 through 18.7 and only fully supported from 26.0 (caniuse). So on the
device most of these clips are shot on, `VideoEncoder` very likely can't take the config,
and the app silently uploads the raw file: a QuickTime `.mov` with HEVC video and, per the
QuickTime default, **`moov` at the end of the file**.

A `moov`-at-the-end file cannot start playing until the last byte has arrived. That is
exactly the reported symptom. It is also why the complaint can be true at the same time as
"but the browser streams MP4 fine".

Two consequences:

- **The format is not always the same.** The pipeline has to cope with H.264/AAC/MP4,
  HEVC/AAC/`.mov`, and VP9/Opus/`.webm`. ffmpeg handles all three; `-c copy` only works on
  the first.
- **Server-side packaging is the only fix for the iOS case.** The client can't remux a
  `moov` to the front without re-encoding, and it can't re-encode there because that's the
  thing that failed.

### Verifying it in ten minutes (do this before building anything)

```bash
# Does R2 honour Range on a presigned GET? Expect "206", not "200".
curl -sI -H "Range: bytes=0-1023" "<presigned url>" | head -5

# Where is the moov in a stored clip? "moov" before "mdat" = fast start.
curl -s -r 0-200000 "<presigned url>" | strings | head
```

Plus, on a real iPhone, watch for the `console.warn('Video compression failed, uploading
the original:')` and `'No hardware encoder for 1080p H.264'` lines already in
`compressVideo.ts`. That tells you how often the fallback path is taken.

---

## 2. Server-side chopping: ffmpeg from Express

### Yes, it belongs on the server

The client compresses because it has the pixels and a hardware encoder; it can't produce a
playlist because the file has to exist in R2 first, at a stable key, owned by the server's
naming scheme. And the iOS case above *needs* a re-encode. So: server-side, after upload.

Nothing about Express makes this special. ffmpeg is a CLI; you `spawn` it and wait. Skip
`fluent-ffmpeg` — it's a wrapper around the exact argument list below and one more
dependency.

### Getting ffmpeg into the Railway image

Railway builds with **Railpack** now (the Nixpacks docs are gone; `nixpacks.toml` is the
wrong file). Railpack takes a `railpack.json` at the root of the directory being built —
which, for a monorepo service whose root is `backend/`, means `backend/railpack.json`.

Two independent lists, and only the second one matters here:

```jsonc
// backend/railpack.json
{
  "$schema": "https://schema.railpack.com",
  "provider": "node",
  "buildAptPackages": ["ffmpeg"],   // build step only — NOT in the final image
  "deploy": {
    "aptPackages": ["ffmpeg"]       // ← the one we need: present at runtime
  }
}
```

`buildAptPackages` installs into the build step and is a trap — the binary won't be in the
final image. `deploy.aptPackages` installs into the runtime image. `ffprobe` ships with the
`ffmpeg` package, so one entry covers both.

Alternatives, in order of preference:

| Option | Notes |
| --- | --- |
| `deploy.aptPackages` (above) | Preferred. No slug bloat, distro-patched binary. Needs a redeploy to take effect. |
| `ffmpeg-static` npm package | Zero build config, pinned version, works anywhere. Adds ~80 MB to the image and `node_modules`. Good fallback if the Railpack file doesn't take. |
| Separate Railway worker service | Only if transcoding starts starving the API. Not needed at this scale. |

**Guard at runtime either way.** Probe once at startup (`spawnSync('ffmpeg', ['-version'])`),
cache the result, and have every packaging call no-op when ffmpeg is absent. The app must
degrade to progressive playback rather than 500 — this is the same posture
`mediaEnabled` and `passkeysEnabled` already take in `backend/src/config/env.ts`.

### What the job actually does

For key `users/<uid>/climbing/<uuid>.mp4`, produce:

```
users/<uid>/climbing/<uuid>/hls/index.m3u8
users/<uid>/climbing/<uuid>/hls/init.mp4        # fMP4 init segment
users/<uid>/climbing/<uuid>/hls/seg_00000.m4s
users/<uid>/climbing/<uuid>/hls/seg_00001.m4s
…
```

The prefix is derived from the video key (`key` minus extension, plus `/hls/`), so **no
Dynamo migration and no change to `MediaRef`** — `backend/src/modules/climbing` keeps not
knowing any of this is happening.

Steps:

1. **Probe** with `ffprobe` for `codec_name` on `v:0` and `a:0`.
2. **Download** to `os.tmpdir()` via `GetObjectCommand` (stream, don't buffer). Reads over
   HTTP from ffmpeg directly are possible but it seeks around unpredictably; one local copy
   is simpler and ffmpeg's disk I/O is nothing.
3. **Package** — see commands below.
4. **Upload** every file in the output dir with `PutObjectCommand`
   (`Content-Type: application/vnd.apple.mpegurl` for `.m3u8`, `video/mp4` for `.m4s`).
5. **Delete the temp dir**, always, in a `finally`.

**Copy path** — H.264 + AAC (i.e. everything our compressor produced). No re-encode:

```bash
ffmpeg -nostdin -y -i input.mp4 \
  -c copy \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename 'seg_%05d.m4s' \
  -hls_flags independent_segments \
  index.m3u8
```

Seconds of CPU, a few hundred kB of RSS. `-c copy` cuts on keyframes, so with our 2-second
keyframe interval a 4-second target lands close to 4 seconds.

**Transcode path** — HEVC `.mov`, VP9 `.webm`, anything not already H.264/AAC:

```bash
ffmpeg -nostdin -y -i input \
  -vf "scale=min(1920\,iw):-2" \
  -c:v libx264 -profile:v main -preset veryfast -crf 23 \
  -maxrate 3M -bufsize 6M -pix_fmt yuv420p \
  -g 120 -keyint_min 120 -sc_threshold 0 \
  -c:a aac -b:a 128k -ac 2 \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename 'seg_%05d.m4s' \
  -hls_flags independent_segments \
  index.m3u8
```

Notes:
- **Rotation.** iPhone `.mov` carries a display matrix; ffmpeg autorotates by default, so
  the `scale` filter sees display dimensions and gets it right. Our own compressed output
  has no matrix (rotation is baked into the pixels in `compressVideo.ts`), so there's
  nothing to double-apply. Worth one manual check on a portrait clip from a phone.
- `-g 120 -sc_threshold 0` gives a clean 4-second keyframe cadence so `-c copy` isn't
  fighting a 10-second GOP later.
- `-profile:v main` matches what the client already emits (`avc1.4d0028`).
- ~30–60 s of wall clock for a 3-minute clip on one Railway vCPU, ~300 MB RSS. Fine.

### Where the job runs

**Async, kicked off by a request, with readiness derived from R2 — not stored in Dynamo.**

- After the upload PUT succeeds, `uploadMedia` fires `POST /api/media/prepare { key }` and
  forgets it. By the time anyone opens the viewer, the package usually exists.
- The server keeps an in-process `Set` of in-flight keys (one job at a time is plenty for
  one user) and an `ffmpegAvailable` flag so a missing binary isn't retried forever.
- Readiness = `HeadObject` on `…/hls/index.m3u8`. Stateless, free, and survives a deploy
  (which an in-memory queue doesn't — worst case the job just runs again, idempotently).

A durable job row in Dynamo is the "proper" answer, but for a single-user app the cost of
losing a job is "the next request re-runs it".

### Cleanup, already-broken things

`mediaService.deleteObject` deletes one key. Deleting a climb currently **leaks every HLS
segment forever**. Add a `deletePrefix` (ListObjectsV2 + DeleteObjects in batches of 1000)
and call it for the HLS prefix in `mediaController.deleteObject` and in `MediaStrip`'s
`removeItem`. Worth fixing even before HLS ships if anything else ever writes a prefix.

### CORS on the bucket

`backend/scripts/create-media-bucket.ts` sets `ExposeHeaders: ['ETag']`. hls.js fetches
segments over XHR and reads response headers, so add `Content-Length` and `Content-Range`:

```js
ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
```

Re-run the script (it's safe to re-run; CORS is re-applied).

---

## 3. Playback: the player and the buffering

### Today

`MediaViewer.tsx` renders a bare `<video src={presignedUrl} controls playsInline autoPlay>`.
That already streams *progressively* — the browser issues `Range` requests and plays as it
goes, as long as `moov` is at the front and R2 answers 206. It is not the problem for
compressed clips; it is the problem for `.mov` originals.

Adding HLS buys three things progressive doesn't have:

1. **ABR** — publish a 720p rendition next to the 1080p one and a weak connection degrades
   instead of stalling. This is the actual "streaming platform" behaviour.
2. **No over-download** — watch 10 seconds of a 3-minute clip and you've fetched ~10
   seconds, not the whole file. (Chrome will happily keep pulling a progressive MP4 after
   you've stopped watching.)
3. **Cheap seeking** — jump to 2:30 without the intermediate bytes.

### Which player

Keep it thin, in the spirit of the existing comment in `MediaViewer.tsx` ("a clip of a
boulder problem needs nothing a player library would add"). **Not** video.js / Plyr / react-player.

- **hls.js** on Chrome, Firefox, Edge, Android — MSE-based, ~50 kB gzipped.
- **Native** `<video src="…m3u8">` on Safari/iOS, because hls.js relies on MSE and iOS
  Safari's MSE story for video is poor. Apple's own players handle HLS natively.
- **Progressive MP4** as the always-available fallback.

Current hls.js recommendation — prefer native only where native HLS is genuinely good
(`ManagedMediaSource` exists; older Safari reports `canPlayType` support and then fails):

```ts
if (video.canPlayType('application/vnd.apple.mpegurl') && 'ManagedMediaSource' in window) {
  video.src = url
} else if (Hls.isSupported()) {
  const hls = new Hls(config)
  hls.loadSource(url)
  hls.attachMedia(video)
} else {
  video.src = progressiveUrl
}
```

Import hls.js dynamically (`await import('hls.js')`) inside the viewer — the session screen
never pays for it until a clip is actually opened, the same trick `MediaStrip` already uses
for `compressVideo`.

### How much to buffer

hls.js has no "initial buffer" knob; it starts as soon as it has the init segment plus the
first fragment. The knobs are segment duration and the steady-state caps. For 3 Mbps with
4-second segments:

| Setting | Value | Why |
| --- | --- | --- |
| `-hls_time` | `4` s | One segment ≈ **1.5 MB at 3 Mbps** — that's the real start-up cost: ~1–3 s on 4G. 6 s halves the request count and doubles time-to-first-frame; 2 s is wasteful. |
| `maxBufferLength` | `10` s | Guaranteed buffer ahead. Default 30 s is 11 MB of video you may never watch. |
| `maxBufferSize` | `15 MB` | Hard byte cap; bites on a high-bitrate rendition. |
| `maxMaxBufferLength` | `30` s | Ceiling so a low-bitrate rendition can't buffer an hour. |
| `backBufferLength` | `30` s | Evict behind the playhead; default `Infinity` keeps the whole watched clip in memory. |
| `capLevelToPlayerSize` | `true` | Don't pull 1080p into a 400 px-wide element. |
| `enableWorker` | `true` | Demuxing off the main thread. |
| `startFragPrefetch` | `false` | Nothing to prefetch in a VOD clip you haven't started. |

Also: keep `poster` on the element (we already generate `posterKey` for every clip) so
there's an image during those first 1.5 MB, and `preload="metadata"` so opening the viewer
isn't the thing that starts the download.

### The auth problem, which is the only genuinely tricky part

Every object in R2 is private; reads go through presigned URLs. HLS means many URLs per
playback. And **Safari's native player sets `video.src` — it cannot send an
`Authorization` header.** Custom headers are simply not an option on that path, so the
playlist URL has to authenticate itself.

Design: **one token in the query string, playlist rewritten server-side, segment URLs
presigned and absolute.**

| Route | Auth | Returns |
| --- | --- | --- |
| `GET /api/media/playback?key=…` | normal `Authorization: Bearer` | `{ mode: 'hls' \| 'progressive', url, status: 'ready' \| 'processing' \| 'unavailable' }`. Kicks off packaging when there's no HLS yet and hands back the progressive URL so playback starts now. |
| `GET /api/media/play?key=…&t=…` | short-lived JWT in `t` | The playlist, `Content-Type: application/vnd.apple.mpegurl`, with every URI rewritten to an absolute URL. |
| `POST /api/media/prepare` | `Authorization: Bearer` | `202`, fire-and-forget. |

- `t` is `jwt.sign({ userId, media: true }, env.JWT_SECRET, { expiresIn: '6h' })`.
  `jsonwebtoken` is already a dependency. The handler verifies it, then still applies
  `ownsKey(userId, key)` — same belt-and-braces as every other media route.
- **Segment URIs must be absolute.** A playlist served from `?key=…` has no usable base
  path for a relative URI to resolve against. Each segment gets a presigned R2 URL minted
  at request time (signing is local HMAC — microseconds each, so 200 segments is nothing).
- `#EXT-X-MAP:URI="init.mp4"` is a URI too and must be rewritten the same way.
- If a segment URL expires mid-session (6 h), hls.js raises a fatal error; the client
  re-requests `/api/media/playback` for a fresh token and resumes at `video.currentTime`.
  Rare enough not to build for, cheap enough to handle.

Rejected alternatives:

- **Proxying segments through Express** — bytes through Railway. R2 egress is free and
  Railway's isn't; it also contradicts the "nothing here proxies bytes" rule written into
  `media.routes.ts`.
- **302 redirects to signed R2 URLs** — works and avoids expiry, but costs a round trip
  per segment for no gain. Hold in reserve if 6-hour TTLs ever bite.
- **Public bucket / `r2.dev`** — no. Every media route exists to check ownership.

### Client changes

- `frontend/src/components/Climbing/VideoPlayer.tsx` — new, owns the three-way choice
  above, `Hls` lifecycle (`destroy()` on unmount), and the fatal-error recovery.
- `MediaViewer.tsx` — render `<VideoPlayer>` instead of `<video>`.
- `frontend/src/hooks/usePlaybackUrl.ts` — `useQuery` on `/api/media/playback?key=…`,
  lazy (`enabled: boolean`), 45-minute stale time to match `useMediaUrls`.
- `uploadMedia` — fire `POST /api/media/prepare` after the PUT lands.
- Thumbnails in `MediaStrip` **stay on the poster image**. `#t=2` is meaningless on an
  m3u8, and `preload="metadata"` on the fallback `<video>` thumbnail is worth dropping to
  `preload="none"` so a page of clips doesn't pre-fetch.

### Renditions (optional, phase 4)

One rendition at 3 Mbps still needs 3 Mbps. A 854×480 / 1.2 Mbps second rendition is what
makes a bad gym connection work, and it's the reason to have HLS at all. It costs a
re-encode (even for compressed sources) and a master playlist with `-var_stream_map`, plus
one more rewrite rule in the playlist handler. Do it after single-rendition is stable, and
only if playback actually stalls in practice.

---

## Build order

**Phase 0 — cheap, no ffmpeg (half a day).** Diagnose and take the free wins.
- [ ] Confirm R2 answers `206` to a ranged presigned GET.
- [ ] Confirm `moov` position on a compressed clip vs. an iPhone original.
- [ ] Log how often `compressVideo` falls back, and why, on a real iPhone.
- [ ] Drop `VIDEO_BITRATE` from `3_000_000` to `2_000_000` — one constant, ~33 % off every
      compressed clip, and nobody will see the difference on a phone.
- [ ] Add `preload="none"` to the fallback `<video>` thumbnails in `MediaStrip`.

**Phase 1 — ffmpeg in the image (half a day).** No behaviour change.
- [ ] `backend/railpack.json` with `deploy.aptPackages: ["ffmpeg"]`.
- [ ] `TRANSCODE_ENABLED` / startup probe; log `ffmpeg -version` on boot.
- [ ] Deploy and confirm the binary is on `PATH` in the running container.

**Phase 2 — the packaging job, behind a flag (1–2 days).**
- [ ] `mediaService.deletePrefix`, wired into delete (fixes the existing leak).
- [ ] `ffprobe` → choose `-c copy` vs. transcode; spawn ffmpeg into a temp dir; upload.
- [ ] In-flight set, single-concurrency queue, hard timeout + `SIGKILL`, temp cleanup.
- [ ] `POST /api/media/prepare`; call it from `uploadMedia`.
- [ ] Backfill script (`backend/scripts/backfill-hls.ts`) — or just let it happen lazily.

**Phase 3 — playlists and the player (2–3 days).**
- [ ] `GET /api/media/play?key=&t=` with URI rewriting (including `#EXT-X-MAP`).
- [ ] `GET /api/media/playback?key=` returning the mode + URL.
- [ ] `VideoPlayer.tsx` + `usePlaybackUrl`; hls.js dynamic import.
- [ ] Bucket CORS `ExposeHeaders` update; re-run `create-media-bucket.ts`.
- [ ] Delete the HLS prefix when a clip is removed.

**Phase 4 — only if it still stalls.** 480p rendition + master playlist + ABR.

### Rough costs

Storage roughly doubles per clip (the MP4 is kept as the fallback and the re-derivation
source; fMP4 segments are ~1–3 % overhead on top). At R2's $0.015/GB-month that's cents.
Class A operations: ~30 writes per clip, $4.50 per million — nothing. The real cost is
Railway CPU on the transcode path, which only HEVC/VP9 sources pay.

---

## Open questions

1. **How often does compression actually get skipped on iOS?** If it's rare, phase 0 might
   be the whole fix and phases 2–4 can wait. Worth ten minutes with a real phone first.
2. **Keep the original MP4 after packaging?** Proposed: yes (fallback + re-derivation).
   Costs ~2× storage, which is pennies.
3. **Byte-range HLS (`-hls_flags single_file`)?** One object per rendition instead of
   ~30, fewer writes, simpler deletion; needs reliable range support, which R2 has.
   Marginal — plain segments are easier to reason about and to debug.
4. **Cloudflare Stream** instead of all of this? It does packaging, ABR and delivery, and
   R2 is already Cloudflare. But it's a separate upload path, a separate bill, and a
   second place the same media lives. Worth pricing once before committing to phase 4;
   almost certainly not worth it for phases 0–3.
5. **Does anything else ever write a prefix?** `deletePrefix` should go in regardless; if
   HLS is ever the only prefixed thing, it can be simpler.

## Notes

- `mp4-muxer` is **deprecated** in favour of [Mediabunny](https://mediabunny.dev/). Not
  urgent — it works — but when `compressVideo.ts` is next touched, that's the migration.
  Mediabunny also ships demuxers, which would replace mp4box at the same time.
- Express is v5: wildcard route params are `*name`, not `*`. Using `?key=` everywhere
  sidesteps it, but don't reach for `'/*'` in the new routes.
- Helmet's default `Referrer-Policy: no-referrer` keeps the playback token out of
  referrer headers. Worth keeping.
