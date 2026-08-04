import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginForm } from '../components/Login/LoginForm'
import { authApi } from '../services/api'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    // Redirect to dashboard if already authenticated
    if (authApi.isAuthenticated()) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-pink-500">
            Vibe My Life
          </h1>
          <p className="text-zinc-400 mt-2">Sign in to continue</p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
