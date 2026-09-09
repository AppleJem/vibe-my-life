import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { passkeyApi, PasskeyCancelled, type Passkey } from '../../../services/api'

export const Route = createFileRoute('/_authenticated/settings/passkeys')({
  component: PasskeysSettingsPage,
})

/** A sensible default label, so enrolling is one tap on the device being enrolled. */
function deviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'This device'
}

function formatDate(iso: string): string {
  if (!iso) return 'never used'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function PasskeysSettingsPage() {
  const navigate = useNavigate()

  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const supported = passkeyApi.isSupported()

  const load = async () => {
    try {
      const { configured: isConfigured } = await passkeyApi.status()
      setConfigured(isConfigured)
      setPasskeys(isConfigured ? await passkeyApi.list() : [])
    } catch {
      setError('Could not load passkeys.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAdd = async () => {
    setError('')
    setAdding(true)

    try {
      const passkey = await passkeyApi.register(deviceName())
      setPasskeys((current) => [...current, passkey])
    } catch (err) {
      if (err instanceof PasskeyCancelled) return
      // The most common real failure is re-enrolling a device that already has one,
      // which the browser refuses via excludeCredentials before the server is reached.
      setError('Could not add a passkey. This device may already have one.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (passkey: Passkey) => {
    if (!confirm(`Remove "${passkey.name}"? You'll need your password to sign in on it again.`)) return

    setError('')
    try {
      await passkeyApi.remove(passkey.id)
      setPasskeys((current) => current.filter((item) => item.id !== passkey.id))
    } catch {
      setError('Could not remove that passkey.')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/settings' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Face ID &amp; Passkeys</h2>
      </div>

      <p className="text-sm text-zinc-400 mb-6">
        Add a passkey to sign in with Face ID instead of your password. Your password keeps
        working as a fallback.
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">
          {error}
        </div>
      )}

      {!supported && (
        <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-4 py-3 rounded-xl text-sm mb-4">
          This browser can't use passkeys. They need a secure (https) connection.
        </div>
      )}

      {supported && !configured && !loading && (
        <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-4 py-3 rounded-xl text-sm mb-4">
          Passkeys aren't set up on the server yet.
        </div>
      )}

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading…</div>
      ) : (
        <>
          {passkeys.length > 0 && (
            <div className="bg-zinc-900 rounded-xl overflow-hidden mb-4">
              {passkeys.map((passkey, index) => (
                <div
                  key={passkey.id}
                  className={`flex items-center justify-between px-4 py-4 ${
                    index < passkeys.length - 1 ? 'border-b border-zinc-800' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-zinc-100 truncate">{passkey.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Added {formatDate(passkey.createdAt)}
                      {passkey.backedUp && ' · synced'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(passkey)}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors shrink-0 ml-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {supported && configured && (
            <button
              onClick={handleAdd}
              disabled={adding}
              className="w-full py-3 bg-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? 'Waiting for Face ID…' : 'Add a passkey'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
