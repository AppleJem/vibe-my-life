import { useAppUpdate } from '../hooks/useAppUpdate'

/**
 * Bottom banner shown when a new build has been downloaded and is waiting to
 * activate. Tapping "Refresh" activates it and reloads. Mounted at the app
 * root so it works on every route (including login).
 */
export function UpdatePrompt() {
  const { needRefresh, reload, dismiss } = useAppUpdate()

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-pink-500/40 bg-zinc-900 p-4 shadow-xl">
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-100">A new version is available</p>
          <p className="text-xs text-zinc-400">Refresh to get the latest fixes and features.</p>
        </div>
        <button
          onClick={dismiss}
          className="px-3 py-2 text-sm text-zinc-300 hover:text-white"
        >
          Later
        </button>
        <button
          onClick={reload}
          className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-600"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}