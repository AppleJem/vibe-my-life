import { useCallback, useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * How often to ask the browser to re-check `/sw.js` while the app is open.
 * The browser's own periodic check is unreliable (throttled to ~24h and only
 * on full navigations), which is why an installed SPA can stay stale for days.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000

/**
 * Detects new deployments of the app and exposes a way to activate them.
 *
 * The service worker precaches the whole build (including index.html), so a
 * running tab/app keeps serving the old version until the SW is updated *and*
 * the page reloads. We force a check on mount, on an interval, and whenever
 * the app returns to the foreground (the common "launch" path on iOS, where
 * installed PWAs are usually resumed rather than reloaded).
 */
export function useAppUpdate() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null
    },
  })

  useEffect(() => {
    const checkForUpdate = () => {
      // Ignore failures (offline, transient server errors) – we retry later.
      registrationRef.current?.update().catch(() => {})
    }

    checkForUpdate()
    const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', checkForUpdate)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', checkForUpdate)
    }
  }, [])

  const reload = useCallback(() => {
    // Tells the waiting SW to activate, then reloads the page.
    void updateServiceWorker(true)
  }, [updateServiceWorker])

  const dismiss = useCallback(() => setNeedRefresh(false), [setNeedRefresh])

  return { needRefresh, reload, dismiss }
}