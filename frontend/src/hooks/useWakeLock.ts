import { useEffect } from 'react'

/**
 * Holds the screen awake while `active` is true.
 *
 * Best-effort by nature: the API is absent on some browsers and rejects outright when the
 * tab is hidden, and there is nothing useful to do about either — the timer keeps running, the
 * display just may sleep. Requested per caller rather than centrally, so two timers running
 * at once each hold their own lock and releasing one doesn't darken the other's.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    void navigator.wakeLock
      .request('screen')
      .then((lock) => {
        // The effect may already have torn down by the time the request resolves.
        if (released) void lock.release()
        else sentinel = lock
      })
      .catch(() => {
        // No lock; nothing else changes.
      })

    return () => {
      released = true
      void sentinel?.release()
    }
  }, [active])
}
