import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ToastContainer } from '../components/ToastContainer'

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Outlet />
      <ToastContainer />
    </div>
  ),
})
