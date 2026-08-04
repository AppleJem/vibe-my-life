import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Press-and-hold, with a progress value so the caller can draw a filling ring.
 *
 * Deliberately not a tap: logging a habit is the one destructive-ish action on the
 * detail page and the box fills the screen, so a stray thumb while scrolling must not
 * count. Three things guard against that — the hold duration, cancelling on any vertical
 * movement past `MOVE_TOLERANCE`, and cancelling on `pointercancel` (which is what the
 * browser fires when it decides the gesture became a scroll).
 */

const MOVE_TOLERANCE = 12

/**
 * Cubic ease-in-out: fast at the head and tail, slow in the middle.
 * Gives that satisfying "whip" snap when the ring completes.
 * https://easings.net/#easeInOutCubic
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

interface Options {
  onComplete: () => void
  durationMs?: number
  disabled?: boolean
}

export function useLongPress({ onComplete, durationMs = 5000, disabled = false }: Options) {
  const [progress, setProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)

  const frameRef = useRef<number | null>(null)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  // Held in a ref so the rAF loop never closes over a stale callback.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const cancel = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    originRef.current = null
    setIsHolding(false)
    setProgress(0)
  }, [])

  // A hold interrupted by an unmount (navigating away mid-press) must not leave a
  // frame scheduled that fires the completion afterwards.
  useEffect(() => cancel, [cancel])

  const start = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return
      // Ignore right-click and any secondary button.
      if (event.button !== 0 && event.pointerType === 'mouse') return

      originRef.current = { x: event.clientX, y: event.clientY }
      setIsHolding(true)

      const startedAt = performance.now()

      const tick = (now: number) => {
        const elapsed = (now - startedAt) / durationMs

        if (elapsed >= 1) {
          frameRef.current = null
          setIsHolding(false)
          setProgress(0)
          onCompleteRef.current()
          return
        }

        setProgress(easeInOutCubic(elapsed))
        frameRef.current = requestAnimationFrame(tick)
      }

      frameRef.current = requestAnimationFrame(tick)
    },
    [disabled, durationMs]
  )

  const move = useCallback(
    (event: React.PointerEvent) => {
      const origin = originRef.current
      if (!origin) return

      const dx = Math.abs(event.clientX - origin.x)
      const dy = Math.abs(event.clientY - origin.y)
      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancel()
    },
    [cancel]
  )

  return {
    isHolding,
    progress,
    handlers: {
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      // Long-press on touch otherwise raises the iOS/Android callout menu.
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    },
  }
}
