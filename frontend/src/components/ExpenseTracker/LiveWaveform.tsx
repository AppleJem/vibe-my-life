import { useRef, useEffect } from 'react'

interface LiveWaveformProps {
  /** Tapped off the recording stream. Null until the audio graph is up. */
  analyser: AnalyserNode | null
  barCount?: number
}

/** How often a new bar is pushed. ~22fps reads as motion without flickering. */
const FRAME_MS = 45

/** Silence still shows a row of dots rather than nothing. */
const MIN_LEVEL = 0.06

/**
 * Speech RMS sits well below 1.0 even when someone is talking normally, so the raw
 * value is scaled up before clamping — otherwise the bars barely leave the floor.
 */
const GAIN = 3.2

/**
 * A scrolling level meter driven by the live microphone signal: each bar is one recent
 * slice of loudness, newest on the right, so speech pushes the bars up and silence
 * flattens them.
 *
 * The animation loop writes bar heights straight to the DOM through refs. Putting the
 * levels in React state would re-render the whole recorder ~22 times a second for a
 * purely visual effect.
 */
export function LiveWaveform({ analyser, barCount = 20 }: LiveWaveformProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!analyser) return

    const levels = new Array<number>(barCount).fill(MIN_LEVEL)
    const samples = new Uint8Array(analyser.fftSize)
    let frameId = 0
    let lastPush = 0
    // Peak since the last push, so a syllable landing between pushes still registers.
    let peak = 0

    const paint = () => {
      for (let i = 0; i < barCount; i++) {
        const bar = barsRef.current[i]
        if (bar) bar.style.height = `${levels[i] * 100}%`
      }
    }

    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick)

      analyser.getByteTimeDomainData(samples)

      // Byte time-domain data is centred on 128; RMS of the deviation is the loudness.
      let sumSquares = 0
      for (let i = 0; i < samples.length; i++) {
        const deviation = (samples[i] - 128) / 128
        sumSquares += deviation * deviation
      }
      const rms = Math.sqrt(sumSquares / samples.length)
      peak = Math.max(peak, Math.min(1, rms * GAIN))

      if (now - lastPush < FRAME_MS) return
      lastPush = now

      levels.shift()
      levels.push(Math.max(MIN_LEVEL, peak))
      peak = 0
      paint()
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [analyser, barCount])

  return (
    <div className="flex items-center justify-center gap-1 h-12 mb-4">
      {Array.from({ length: barCount }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el
          }}
          className="w-1 bg-pink-500 rounded-full transition-[height] duration-75 ease-out"
          style={{ height: `${MIN_LEVEL * 100}%` }}
        />
      ))}
    </div>
  )
}
