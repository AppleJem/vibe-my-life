import {
  createFile,
  DataStream,
  Endianness,
  MP4BoxBuffer,
  type Descriptor,
  type ISOFile,
  type Sample,
  type Track,
} from 'mp4box'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

/**
 * Re-encodes a clip to 1080p before it is uploaded.
 *
 * A phone shooting 4K writes something like 50 Mbps, so a thirty-second problem is well
 * over a hundred megabytes — none of which survives being watched on a phone to see which
 * holds were used. Re-encoding to 1080p at a few Mbps is a 10–15× saving.
 *
 * The pipeline is demux (mp4box) → decode (WebCodecs) → draw scaled to a canvas → encode
 * (WebCodecs) → remux (mp4-muxer). WebCodecs uses the device's hardware encoder, so this
 * runs several times faster than the clip's own duration rather than in real time.
 *
 * Everything is best-effort: any failure, unsupported browser, or codec the device can't
 * handle falls back to uploading the original. A worse-quality upload is a bad outcome; a
 * lost clip is a much worse one.
 */

/** Long edge. A boulder problem is legible well below this; it's the cap, not the target. */
const MAX_DIMENSION = 1920

/** Enough for wall texture and chalk at 1080p without paying for grain in the mats. */
const VIDEO_BITRATE = 3_000_000

/** Below this the transcode costs more than it saves. */
const SKIP_BELOW_BYTES = 8 * 1024 * 1024

/**
 * How long to let a transcode run before giving up and uploading the original. A very long
 * clip on a slow device shouldn't strand someone at the gym watching a progress bar.
 */
const TIMEOUT_MS = 5 * 60 * 1000

/**
 * The frame to keep as the thumbnail — two seconds in at 30fps.
 *
 * Not the first frame, which on a climbing clip is usually somebody standing still at the
 * bottom of the wall, or a blur as the phone is propped up. A short clip uses its midpoint
 * instead, so there is always a frame to take.
 */
const POSTER_FRAME = 60

/** Long edge of the stored thumbnail. Four times the 64px it renders at, for retina. */
const POSTER_SIZE = 256

export interface VideoCompressionResult {
  /** The compressed clip, or the original when compressing wasn't possible or worthwhile. */
  file: File
  /** A still frame to use as the thumbnail, when one could be taken. */
  poster: Blob | null
}

export interface VideoCompressionSupport {
  supported: boolean
  reason?: string
}

/** Whether this browser has the pieces at all, checked before anything is decoded. */
export function canCompressVideo(): VideoCompressionSupport {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    return { supported: false, reason: 'WebCodecs is not available' }
  }
  return { supported: true }
}

/**
 * mp4box needs the whole file as one ArrayBuffer carrying a `fileStart`, and it only emits
 * samples once `start()` is called. This wraps the callback API into "give me every sample
 * of the video track, plus the description the decoder needs".
 */
async function demux(file: File): Promise<{
  videoTrack: Track
  audioTrack: Track | null
  videoSamples: Sample[]
  audioSamples: Sample[]
  description: Uint8Array
  audioConfig: Uint8Array | null
}> {
  const buffer = await file.arrayBuffer()

  const mp4 = createFile(true)
  const videoSamples: Sample[] = []
  const audioSamples: Sample[] = []
  let videoTrack: Track | null = null
  let audioTrack: Track | null = null
  const warnings: string[] = []

  /**
   * Recorded, not thrown.
   *
   * mp4box reports every box it couldn't read through `onError`, and on a real recording
   * that routinely includes the padding a phone leaves after the last real box —
   * "Invalid box type: ''" and friends. Treating that as fatal aborts a demux whose samples
   * have already been handed over in full, and the clip then uploads uncompressed. Whether
   * the demux actually worked is decided below, by checking we got what we came for.
   */
  mp4.onError = (module: string, message: string) => warnings.push(`${module}: ${message}`)

  mp4.onReady = (info) => {
    videoTrack = info.videoTracks?.[0] ?? null
    audioTrack = info.audioTracks?.[0] ?? null

    /**
     * A sound track mp4box didn't file as audio — uncompressed PCM in a QuickTime `.mov`
     * comes through as 'metadata', for instance. Nothing here can carry it (the output
     * declares an AAC track and copies samples verbatim), but losing sound should never be
     * something the app does quietly.
     */
    if (!audioTrack && (info.tracks?.length ?? 0) > (info.videoTracks?.length ?? 0)) {
      const carried = new Set(info.videoTracks?.map((t) => t.id))
      const ignored = info.tracks.filter((t) => !carried.has(t.id)).map((t) => t.codec)
      if (ignored.length > 0) {
        console.warn(`Ignoring track(s) this transcode can't carry: ${ignored.join(', ')}`)
      }
    }

    if (!videoTrack) return

    mp4.setExtractionOptions(videoTrack.id, null, { nbSamples: Infinity })
    if (audioTrack) mp4.setExtractionOptions(audioTrack.id, null, { nbSamples: Infinity })
    mp4.start()
  }

  mp4.onSamples = (trackId, _user, samples) => {
    if (trackId === (videoTrack as Track | null)?.id) videoSamples.push(...samples)
    else if (trackId === (audioTrack as Track | null)?.id) audioSamples.push(...samples)
  }

  // mp4box parses synchronously, so by the time these return every callback above has
  // already run and the results can simply be inspected — no waiting on a promise that a
  // truncated file would leave hanging forever.
  mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buffer, 0), true)
  mp4.flush()

  if (warnings.length > 0) {
    console.debug('mp4 parse warnings (usually trailing padding):', warnings)
  }

  const track = videoTrack as Track | null
  if (!track) throw new Error('No video track')

  // Short of the count the header promised means the parse really did stop early, and a
  // clip missing its tail is worse than one that was never compressed.
  if (videoSamples.length < track.nb_samples) {
    throw new Error(`Only ${videoSamples.length} of ${track.nb_samples} video samples parsed`)
  }

  // Whatever audio arrived is kept, even if it is short of the count the header promised.
  // Demanding the full count threw away the entire soundtrack over a few missing frames at
  // the end, which is a far worse trade than a clip whose last moments are silent.
  const sound = audioTrack as Track | null
  if (sound && audioSamples.length < sound.nb_samples) {
    console.debug(
      `Audio: ${audioSamples.length} of ${sound.nb_samples} samples parsed; keeping what arrived.`
    )
  }

  return {
    videoTrack: track,
    audioTrack: sound,
    videoSamples,
    audioSamples,
    description: avcDescription(mp4, track.id),
    audioConfig: sound ? audioDescription(mp4, sound.id) : null,
  }
}

/**
 * The raw avcC/hvcC box, which is what `VideoDecoder` wants as its `description`. Without
 * it an H.264 stream in `avc1` format cannot be decoded at all — the SPS and PPS live here
 * rather than in the samples.
 */
function avcDescription(mp4: ISOFile, trackId: number): Uint8Array {
  const entries = mp4.getTrackById(trackId).mdia.minf.stbl.stsd.entries

  for (const entry of entries) {
    const fields = entry as unknown as Record<string, unknown>
    const box = fields.avcC ?? fields.hvcC
    if (!box) continue

    const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN)
    ;(box as { write: (s: DataStream) => void }).write(stream)
    // The first 8 bytes are the box header, which the decoder does not want.
    return new Uint8Array(stream.buffer, 8)
  }

  throw new Error('No codec description in the video track')
}

/**
 * The AudioSpecificConfig buried in the track's `esds` box — the handful of bytes saying
 * which AAC profile, sample rate and channel layout the samples use. The muxer needs it to
 * write a playable audio track; without it the samples are undecodable noise.
 *
 * Returns null rather than throwing: a clip whose audio can't be described is still worth
 * compressing, it just comes out silent.
 */
function audioDescription(mp4: ISOFile, trackId: number): Uint8Array | null {
  /**
   * Tag 0x05 is DecoderSpecificInfo, whose payload *is* the AudioSpecificConfig. It sits
   * two levels down — ES_Descriptor → DecoderConfigDescriptor (0x04) → this — and mp4box's
   * own `findDescriptor` only looks at direct children, so walk the tree instead of
   * hard-coding the path any particular muxer happened to produce.
   */
  const findConfig = (descs: Descriptor[] | undefined): Uint8Array | null => {
    for (const desc of descs ?? []) {
      if (desc.tag === 0x05 && desc.data?.length) return new Uint8Array(desc.data)
      const nested = findConfig(desc.descs as Descriptor[] | undefined)
      if (nested) return nested
    }
    return null
  }

  try {
    const entries = mp4.getTrackById(trackId).mdia.minf.stbl.stsd.entries

    for (const entry of entries) {
      const esds = (entry as unknown as Record<string, unknown>).esds as
        | { esd?: { descs?: Descriptor[] } }
        | undefined

      const config = findConfig(esds?.esd?.descs)
      if (config) return config
    }
  } catch {
    // Fall through to null — see above.
  }

  return null
}

/**
 * How far the container says the decoded frames must be turned, clockwise, to be upright.
 *
 * A phone records in sensor orientation and describes the intended display orientation in
 * the track header's transformation matrix — a portrait clip is stored as landscape frames
 * plus a quarter turn. The decoder hands back the frames as coded, knowing nothing about
 * it, so a transcode that ignores the matrix produces a sideways video. This is the same
 * trap as EXIF orientation on a photo, and it has the same answer: bake the rotation into
 * the pixels, because the re-encoded file carries no matrix of its own.
 *
 * The matrix is 16.16 fixed point laid out {a, b, u, c, d, v, x, y, w}; a and b alone
 * determine a cardinal rotation. Anything that isn't a right angle — a sheared or mirrored
 * matrix, which a front camera can produce — is left alone rather than guessed at.
 */
function trackRotation(track: Track): 0 | 90 | 180 | 270 {
  const matrix = track.matrix as ArrayLike<number> | undefined
  if (!matrix || matrix.length < 2) return 0

  const degrees = Math.round((Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI)
  const normalised = ((degrees % 360) + 360) % 360

  return ([0, 90, 180, 270] as const).find((r) => r === normalised) ?? 0
}

/** The sampling frequencies an AudioSpecificConfig can name, by their index in the spec. */
const AAC_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000,
  24000, 22050, 16000, 12000, 11025, 8000, 7350,
]

/**
 * Builds the two-byte AudioSpecificConfig for AAC-LC at a given rate and channel count.
 *
 * Used only when the config couldn't be read out of the file's own `esds`. The layout is
 * fixed: 5 bits of object type (2 = AAC-LC), 4 bits of sample-rate index, 4 bits of channel
 * configuration, then padding. Reconstructing it is safe precisely because everything in it
 * is already known from the track header.
 */
function aacLcConfig(sampleRate: number, channels: number): Uint8Array | null {
  const rateIndex = AAC_SAMPLE_RATES.indexOf(sampleRate)
  if (rateIndex === -1 || channels < 1 || channels > 7) return null

  const objectType = 2
  return new Uint8Array([
    (objectType << 3) | (rateIndex >> 1),
    ((rateIndex & 1) << 7) | (channels << 3),
  ])
}

/**
 * Compresses a clip, reporting 0–1 as it goes. Returns the original file whenever
 * transcoding isn't possible or didn't help. Never throws.
 */
export async function compressVideo(
  file: File,
  onProgress: (fraction: number) => void = () => {},
  signal?: AbortSignal
): Promise<VideoCompressionResult> {
  const original = { file, poster: null }

  if (!file.type.startsWith('video/') || file.size < SKIP_BELOW_BYTES) return original
  if (!canCompressVideo().supported) return original

  try {
    return await withTimeout(transcode(file, onProgress, signal), TIMEOUT_MS, original)
  } catch (err) {
    // An abort is the caller's decision and has to propagate; everything else is a reason
    // to fall back rather than to fail the upload.
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    console.warn('Video compression failed, uploading the original:', err)
    return original
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn('Video compression timed out, uploading the original')
      resolve(fallback)
    }, ms)
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

async function transcode(
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal
): Promise<VideoCompressionResult> {
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
  }

  const { videoTrack, audioTrack, videoSamples, audioSamples, description, audioConfig } =
    await demux(file)
  throwIfAborted()

  const sourceWidth = videoTrack.video?.width ?? 0
  const sourceHeight = videoTrack.video?.height ?? 0
  if (!sourceWidth || !sourceHeight) throw new Error('Video track has no dimensions')

  // A quarter turn means the shape the viewer sees is the coded one on its side, so every
  // size below is derived from the *display* dimensions, not the coded ones.
  const rotation = trackRotation(videoTrack)
  const quarterTurn = rotation === 90 || rotation === 270
  const displayWidth = quarterTurn ? sourceHeight : sourceWidth
  const displayHeight = quarterTurn ? sourceWidth : sourceHeight

  // Even dimensions: H.264's chroma subsampling can't represent an odd one, and encoders
  // reject or silently pad them.
  const scale = Math.min(1, MAX_DIMENSION / Math.max(displayWidth, displayHeight))
  const width = Math.round((displayWidth * scale) / 2) * 2
  const height = Math.round((displayHeight * scale) / 2) * 2

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D context')

  // The frame is drawn in its own unrotated shape, which is the canvas transposed whenever
  // the turn is a quarter one.
  const drawWidth = quarterTurn ? height : width
  const drawHeight = quarterTurn ? width : height

  /**
   * The thumbnail is copied off the encode canvas mid-loop, so it costs one `drawImage` and
   * arrives already scaled and already rotated. It needs a canvas of its own because the
   * encode canvas is overwritten by the very next frame.
   */
  const posterScale = Math.min(1, POSTER_SIZE / Math.max(width, height))
  const posterCanvas = new OffscreenCanvas(
    Math.max(1, Math.round(width * posterScale)),
    Math.max(1, Math.round(height * posterScale))
  )
  const posterCtx = posterCanvas.getContext('2d')
  let posterTaken = false

  // Constant for the whole clip, so it is set once rather than per frame. Rotating about
  // the canvas centre and drawing centred is what makes the turned frame land square on it.
  if (rotation !== 0) {
    ctx.translate(width / 2, height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-drawWidth / 2, -drawHeight / 2)
  }

  /**
   * Audio is copied through rather than re-encoded. It is already AAC in anything a phone
   * produces, it is a rounding error next to the video bitrate, and a copy is both faster
   * than a transcode and lossless.
   */
  const sampleRate = audioTrack?.audio?.sample_rate ?? 0
  const channels = audioTrack?.audio?.channel_count ?? 0

  /**
   * Only AAC can be copied through, because the output track is declared as AAC and the
   * samples are written verbatim. A QuickTime `.mov` may carry PCM or ALAC instead, and
   * those bytes described as AAC would decode to noise — which is worse than no sound. So
   * the codec is checked rather than assumed, and anything else loses its audio knowingly.
   */
  const isAac = (audioTrack?.codec ?? '').startsWith('mp4a.40')

  // With an AAC track confirmed, a missing config is recoverable: the two bytes the muxer
  // needs follow from the rate and channel count, so a container whose `esds` is laid out
  // in a way the walk above didn't recognise still keeps its sound.
  const config = isAac
    ? audioConfig ?? (sampleRate && channels ? aacLcConfig(sampleRate, channels) : null)
    : null

  const keepAudio = Boolean(audioTrack && config && audioSamples.length > 0)

  if (audioTrack && !keepAudio) {
    console.warn('Dropping audio from this clip:', {
      codec: audioTrack.codec,
      reason: !isAac ? 'not AAC — cannot be copied through' : 'no usable decoder config',
      samples: audioSamples.length,
      sampleRate,
      channels,
    })
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    ...(keepAudio && {
      audio: { codec: 'aac' as const, sampleRate, numberOfChannels: channels },
    }),
    fastStart: 'in-memory',
    /**
     * A real recording rarely starts both tracks at exactly zero — an edit list, or the
     * priming samples an AAC encoder puts in front of the audio, leave a small offset. The
     * default 'strict' rejects that outright, and the rejection lands somewhere it can't be
     * recovered from, so shift both tracks onto a common zero instead. 'cross-track-offset'
     * rather than 'offset' because shifting each track by its *own* first timestamp would
     * quietly destroy the A/V sync the offsets encode.
     */
    firstTimestampBehavior: 'cross-track-offset',
  })

  // avc1.4d0028 — Main profile, level 4.0. Broad hardware support, and enough for 1080p30.
  const encoderConfig: VideoEncoderConfig = {
    codec: 'avc1.4d0028',
    width,
    height,
    bitrate: VIDEO_BITRATE,
    framerate: 30,
    /**
     * Keeps the encoder off B-frames, so the chunks it emits are in presentation order.
     *
     * Main profile permits B-frames, and an encoder that uses them emits chunks in *decode*
     * order — whose timestamps run backwards. The muxer requires monotonically increasing
     * ones and rejects the rest, which is how a source with B-frames (anything shot on a
     * phone in HEVC) used to lose every frame. Muxing them properly would mean carrying a
     * composition-time offset per sample; not using them costs a little efficiency at this
     * bitrate and nothing else.
     */
    latencyMode: 'realtime',
  }

  const { supported } = await VideoEncoder.isConfigSupported(encoderConfig)
  if (!supported) throw new Error('No hardware encoder for 1080p H.264')

  let encoderError: unknown = null

  const encoder = new VideoEncoder({
    // Guarded because this runs inside a WebCodecs callback, where a throw goes nowhere:
    // the chunk is dropped, the transcode carries on regardless, and the only symptom is a
    // baffling failure at `finalize` about a track that never received a sample.
    output: (chunk, meta) => {
      try {
        muxer.addVideoChunk(chunk, meta)
      } catch (err) {
        encoderError = encoderError ?? err
      }
    },
    error: (err) => { encoderError = err },
  })
  encoder.configure(encoderConfig)

  let decoded = 0
  const total = videoSamples.length || 1

  // Two seconds in, or the midpoint of anything shorter than that.
  const posterFrame = Math.min(POSTER_FRAME, Math.max(0, Math.floor(videoSamples.length / 2)))

  const decoder = new VideoDecoder({
    output: (frame) => {
      // Drawing through the canvas is what does the scaling and the rotation; a VideoFrame
      // built straight from another frame can do neither.
      ctx.drawImage(frame, 0, 0, drawWidth, drawHeight)

      const scaled = new VideoFrame(canvas, {
        timestamp: frame.timestamp,
        duration: frame.duration ?? undefined,
      })
      frame.close()

      // A keyframe every two seconds keeps seeking usable without costing much.
      encoder.encode(scaled, { keyFrame: decoded % 60 === 0 })
      scaled.close()

      if (decoded === posterFrame && posterCtx) {
        posterCtx.drawImage(canvas, 0, 0, posterCanvas.width, posterCanvas.height)
        posterTaken = true
      }

      decoded += 1
      onProgress(Math.min(0.98, decoded / total))
    },
    error: (err) => { encoderError = err },
  })

  decoder.configure({
    codec: videoTrack.codec,
    codedWidth: sourceWidth,
    codedHeight: sourceHeight,
    description,
  })

  for (const sample of videoSamples) {
    throwIfAborted()
    if (encoderError) throw encoderError
    if (!sample.data) continue

    decoder.decode(new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1_000_000) / sample.timescale,
      duration: (sample.duration * 1_000_000) / sample.timescale,
      data: sample.data,
    }))

    // Without this the whole clip is queued at once and a long video exhausts memory
    // before a single frame has come out the far end.
    if (decoder.decodeQueueSize > 30) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  await decoder.flush()
  await encoder.flush()
  decoder.close()
  encoder.close()

  if (encoderError) throw encoderError

  if (keepAudio) {
    // Written after the video so the muxer has the video timeline established; the
    // timestamps are absolute, so the interleaving order doesn't affect playback.
    for (const sample of audioSamples) {
      if (!sample.data) continue
      muxer.addAudioChunkRaw(
        sample.data,
        sample.is_sync ? 'key' : 'delta',
        (sample.cts * 1_000_000) / sample.timescale,
        (sample.duration * 1_000_000) / sample.timescale,
        { decoderConfig: {
          codec: 'mp4a.40.2',
          sampleRate,
          numberOfChannels: channels,
          description: config!,
        } }
      )
    }
  }

  muxer.finalize()
  const { buffer } = muxer.target as ArrayBufferTarget
  onProgress(1)

  const poster = posterTaken
    ? await posterCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 }).catch(() => null)
    : null

  // A clip already smaller than what we produced was better off as it was — but the frame
  // we took is still the thumbnail, since the original has none either way.
  if (buffer.byteLength >= file.size) return { file, poster }

  const name = file.name.replace(/\.[^.]+$/, '') + '.mp4'
  return {
    file: new File([buffer], name, { type: 'video/mp4', lastModified: file.lastModified }),
    poster,
  }
}
