/**
 * Synthesized sound effects for the habit checkbox.
 * Uses Web Audio API so we have zero external dependencies and full control.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
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

/**
 * Satisfying "klang" — a bright metallic impact with a quick decay.
 * Think of a magical completion chime.
 */
export function playCompletionKlang() {
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
