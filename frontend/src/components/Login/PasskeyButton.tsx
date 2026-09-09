import { useEffect, useState } from 'react'
import { passkeyApi, PasskeyCancelled } from '../../services/api'

interface Props {
  onSuccess: () => void
  onError: (message: string) => void
  disabled?: boolean
}

/**
 * Renders nothing until it knows a passkey is actually usable — the server has an RP
 * configured, one is enrolled, and this browser supports WebAuthn. Showing a Face ID
 * button that can only fail is worse than showing no button.
 */
export function PasskeyButton({ onSuccess, onError, disabled }: Props) {
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!passkeyApi.isSupported()) return

    let cancelled = false
    passkeyApi
      .status()
      .then(({ configured, registered }) => {
        if (!cancelled) setAvailable(configured && registered)
      })
      // A server that can't answer is a server that can't verify one either.
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  if (!available) return null

  const handleClick = async () => {
    onError('')
    setBusy(true)

    try {
      await passkeyApi.login()
      onSuccess()
    } catch (error) {
      // Dismissing the OS sheet is a decision, not a failure — leave the form as it was.
      if (error instanceof PasskeyCancelled) return
      onError('Passkey sign-in failed. Use your password instead.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 border border-zinc-700 text-zinc-100 font-semibold rounded-xl hover:bg-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 10h.01M15 10h.01M9.5 14.5a3.5 3.5 0 005 0" />
        </svg>
        {busy ? 'Waiting for Face ID…' : 'Sign in with Face ID'}
      </button>

      <div className="flex items-center gap-3 mt-6">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs text-zinc-500">or use your password</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
    </div>
  )
}
