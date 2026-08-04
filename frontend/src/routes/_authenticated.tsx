import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authApi } from '../services/api'
import { CategoriesProvider } from '../contexts/CategoriesContext'
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
    <CategoriesProvider>
      <Layout>
        <Outlet />
      </Layout>
    </CategoriesProvider>
  ),
})
