/**
 * Sound effects for the habit checkbox. The hold swoosh is synthesized (it has to
 * stretch to whatever the hold duration is); the completion is a sample.
 */

import completionUrl from '../assets/completion.mp3?url'

/** Safari 16.4+ only; not yet in TypeScript's DOM lib. */
declare global {
  interface Navigator {
    audioSession: { type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record' }
  }
}

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    // iOS puts Web Audio in the "ambient" session by default, which the hardware
    // Ring/Silent switch mutes on the built-in speaker — external routes like
    // AirPods ignore the switch, so the sound only seemed to work on headphones.
    // "playback" opts into the media session, which the switch doesn't gate.
    if ('audioSession' in navigator) {
      navigator.audioSession.type = 'playback'
    }
    audioCtx = new AudioContext()
    // Start decoding now: the swoosh opens the context a full hold ahead of the
    // completion sound, so the sample is ready by the time we need it.
    void loadCompletion(audioCtx)
  }
  // Safari suspends the context when the tab backgrounds; resume is a no-op if
  // we're already running, and this always runs inside the hold's touch gesture.
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

/**
 * "Gathering power" swoosh — a rising filtered noise that builds energy.
 * Plays for the full duration of the hold.
 */
export function playChargeSwoosh(durationSec: number): { stop: () => void } {
  const ctx = getCtx()
  const now = ctx.currentTime

  // White noise source
  const bufferSize = ctx.sampleRate * durationSec
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  // Bandpass filter that sweeps upward — gives it that "rising energy" feel
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(200, now)
  filter.frequency.exponentialRampToValueAtTime(3000, now + durationSec * 0.85)
  filter.Q.value = 2

  // Volume: starts quiet, builds to a crescendo, then dips right before the clang
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.15, now + durationSec * 0.15)
  gain.gain.linearRampToValueAtTime(0.4, now + durationSec * 0.7)
  gain.gain.linearRampToValueAtTime(0.25, now + durationSec * 0.95)
  gain.gain.linearRampToValueAtTime(0, now + durationSec)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  noise.start(now)
  noise.stop(now + durationSec)

  return {
    stop: () => {
      try {
        gain.gain.cancelScheduledValues(now)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05)
        noise.stop(ctx.currentTime + 0.06)
      } catch {
        // already stopped
      }
    },
  }
}

let completionBuffer: AudioBuffer | null = null
let completionLoad: Promise<void> | null = null

function loadCompletion(ctx: AudioContext): Promise<void> {
  if (!completionLoad) {
    completionLoad = fetch(completionUrl)
      .then((res) => res.arrayBuffer())
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => {
        completionBuffer = buffer
      })
      .catch(() => {
        // Leave the buffer null — playCompletionKlang falls back to the synth.
      })
  }
  return completionLoad
}

/** Celebratory win jingle on completion. */
export function playCompletionKlang() {
  const start = Date.now();
  console.log("start playCompletionKlang at", new Date().toISOString())
  const ctx = getCtx()
  if (!completionBuffer) {
    // Not decoded yet (or the fetch failed) — don't leave the hold silent.
    playSynthKlang()
    return
  }

  const source = ctx.createBufferSource()
  source.buffer = completionBuffer

  const gain = ctx.createGain()
  gain.gain.value = 0.6

  source.connect(gain)
  gain.connect(ctx.destination)
  const end = Date.now()
  console.log("source.start playCompletionKlang latency", end - start)
  source.start(ctx.currentTime)
}

/**
 * Synthesized "klang" — a bright metallic impact with a quick decay.
 * The fallback for when the sample hasn't loaded.
 */
function playSynthKlang() {
  const ctx = getCtx()
  const now = ctx.currentTime

  // Two detuned oscillators for a rich, metallic tone
  const osc1 = ctx.createOscillator()
  osc1.type = 'sine'
  osc1.frequency.value = 880 // A5

  const osc2 = ctx.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = 1320 // E6 — perfect fifth above for shimmer

  const osc3 = ctx.createOscillator()
  osc3.type = 'triangle'
  osc3.frequency.value = 1760 // A6 — octave for brightness

  // Sharp attack, fast decay — the "klang"
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.5, now + 0.01) // snap on
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8) // ring out

  // High-pass to keep it crisp, not boomy
  const hiPass = ctx.createBiquadFilter()
  hiPass.type = 'highpass'
  hiPass.frequency.value = 600

  osc1.connect(gain)
  osc2.connect(gain)
  osc3.connect(gain)
  gain.connect(hiPass)
  hiPass.connect(ctx.destination)

  osc1.start(now)
  osc2.start(now)
  osc3.start(now)

  osc1.stop(now + 0.9)
  osc2.stop(now + 0.9)
  osc3.stop(now + 0.9)
}
