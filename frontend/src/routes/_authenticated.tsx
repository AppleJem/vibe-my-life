import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authApi } from '../services/api'
import { MetadataProvider } from '../contexts/MetadataContext'
import { Layout } from '../components/Layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!authApi.isAuthenticated()) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: () => (
    <MetadataProvider>
      <Layout>
        <Outlet />
      </Layout>
    </MetadataProvider>
  ),
})
