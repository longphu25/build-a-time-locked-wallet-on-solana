import { AppProviders } from '@/components/app-providers.tsx'
import { AppLayout } from '@/components/app-layout.tsx'
import { RouteObject, useRoutes } from 'react-router'
import { lazy } from 'react'

const links = [
  //
  { label: 'Home', path: '/' },
  { label: 'Account', path: '/account' },
  { label: 'Time-Locked Wallet', path: '/time-locked-wallet' },
]

const LazyAccountIndex = lazy(() => import('@/components/account/account-index-feature'))
const LazyAccountDetail = lazy(() => import('@/components/account/account-detail-feature'))
const LazyTimeLockedWallet = lazy(() => import('@/components/time-locked-wallet/time-locked-wallet-feature'))
const LazyDashboard = lazy(() => import('@/components/dashboard/dashboard-feature'))

const routes: RouteObject[] = [
  { index: true, element: <LazyDashboard /> },
  {
    path: 'account',
    children: [
      { index: true, element: <LazyAccountIndex /> },
      { path: ':address', element: <LazyAccountDetail /> },
    ],
  },
  { path: 'time-locked-wallet', element: <LazyTimeLockedWallet /> },
]

console.log({ links, routes })

export function App() {
  const router = useRoutes(routes)
  return (
    <AppProviders>
      <AppLayout links={links}>{router}</AppLayout>
    </AppProviders>
  )
}
