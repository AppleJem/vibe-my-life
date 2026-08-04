/**
 * Converts a recorded audio Blob (WebM/Opus on Chrome, MP4/AAC on Safari) into a
 * 16kHz mono 16-bit WAV. Speech-to-text APIs parse WAV reliably everywhere, which
 * the browser-native containers don't always do — MediaRecorder output has no
 * duration in its header and some parsers reject it outright.
 * Uses the Web Audio API so we keep zero external dependencies.
 */

const TARGET_SAMPLE_RATE = 16000

/** Safari only supports the callback form of decodeAudioData. */
function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const maybePromise = ctx.decodeAudioData(data, resolve, reject)
    if (maybePromise instanceof Promise) maybePromise.then(resolve, reject)
  })
}

/** Average all channels down to a single mono track. */
function toMono(buffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = buffer
  if (numberOfChannels === 1) return buffer.getChannelData(0)

  const mono = new Float32Array(length)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) mono[i] += data[i]
  }
  for (let i = 0; i < length; i++) mono[i] /= numberOfChannels
  return mono
}

/** Resample a mono track to the target rate via OfflineAudioContext. */
async function resample(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Promise<Float32Array> {
  if (fromRate === toRate) return samples

  const frames = Math.ceil((samples.length * toRate) / fromRate)
  const offline = new OfflineAudioContext(1, frames, toRate)
  const source = offline.createBufferSource()
  const buffer = offline.createBuffer(1, samples.length, fromRate)
  buffer.getChannelData(0).set(samples)
  source.buffer = buffer
  source.connect(offline.destination)
  source.start()

  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

/** Wrap 16-bit PCM samples in a 44-byte RIFF/WAVE header. */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // format: PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate (mono, 2 bytes/sample)
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }

  return buffer
}

export async function blobToWav(
  blob: Blob,
  sampleRate = TARGET_SAMPLE_RATE
): Promise<Blob> {
  const ctx = new AudioContext()
  try {
    const decoded = await decode(ctx, await blob.arrayBuffer())
    const mono = toMono(decoded)
    const resampled = await resample(mono, decoded.sampleRate, sampleRate)
    return new Blob([encodeWav(resampled, sampleRate)], { type: 'audio/wav' })
  } finally {
    void ctx.close()
  }
}
