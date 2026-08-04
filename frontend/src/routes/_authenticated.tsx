import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authApi } from '../services/api'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!authApi.isAuthenticated()) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: () => <Outlet />,
})
