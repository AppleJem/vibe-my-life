import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authApi } from '../services/api'
import { MetadataProvider } from '../contexts/MetadataContext'
import { Layout } from '../components/Layout'
import { useRecurringCatchUp } from '../hooks/useRecurring'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!authApi.isAuthenticated()) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  // Entry into the app is where due subscriptions and salary get written, so this sits
  // above every authenticated page rather than on the dashboard alone.
  useRecurringCatchUp()

  return (
    <MetadataProvider>
      <Layout>
        <Outlet />
      </Layout>
    </MetadataProvider>
  )
}
