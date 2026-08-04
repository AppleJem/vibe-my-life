import { useNavigate } from '@tanstack/react-router'
import { authApi } from '../services/api'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()

  const handleLogout = () => {
    authApi.logout()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-pink-500">
            Vibe My Life
          </h1>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
