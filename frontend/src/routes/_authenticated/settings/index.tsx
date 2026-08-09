import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '../../../services/api'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsPage,
})

function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleLogout = () => {
    authApi.logout()
    // Drop cached expenses so the next sign-in on this device starts clean.
    queryClient.clear()
    navigate({ to: '/login' })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
      </div>

      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        <button
          onClick={() => navigate({ to: '/settings/currency' })}
          className="w-full flex items-center justify-between px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-zinc-100">Currency</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => navigate({ to: '/settings/budget' })}
          className="w-full flex items-center justify-between px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-zinc-100">Monthly Budget</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => navigate({ to: '/settings/categories' })}
          className="w-full flex items-center justify-between px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-zinc-100">Configure Categories</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => navigate({ to: '/settings/recurring' })}
          className="w-full flex items-center justify-between px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-zinc-100">Recurring Items</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => navigate({ to: '/settings/import' })}
          className="w-full flex items-center justify-between px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-zinc-100">Import backup</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-4 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-red-400">Logout</span>
        </button>
      </div>
    </div>
  )
}
