import { useEffect } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom'
import { Show, AuthenticateWithRedirectCallback, useAuth } from '@clerk/react'
import { AppShell } from './components/shell/AppShell'
import { PipelinePage } from './pages/PipelinePage/PipelinePage'
import { LogsPage } from './pages/LogsPage/LogsPage'
import { AnalyticsPage } from './pages/AnalyticsPage/AnalyticsPage'
import { SponsorsPage } from './pages/SponsorsPage/SponsorsPage'
import { CompaniesPage } from './pages/CompaniesPage/CompaniesPage'
import { FundsPage } from './pages/FundsPage/FundsPage'
import { PortfolioPage } from './pages/PortfolioPage/PortfolioPage'
import { InboxPage } from './pages/InboxPage/InboxPage'
import { ExecutiveSummaryPage } from './pages/ExecutiveSummaryPage/ExecutiveSummaryPage'
import { ChatPage } from './pages/ChatPage/ChatPage'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { DealDetailPage, LegacyDealTabRedirect } from './pages/DealDetailPage/DealDetailPage'
import { registerTokenGetter } from './api/client'

function AuthBridge() {
  const { getToken } = useAuth()
  useEffect(() => {
    registerTokenGetter(() => getToken())
    return () => registerTokenGetter(null)
  }, [getToken])
  return null
}

function AuthGate() {
  return (
    <>
      <AuthBridge />
      <Show when="signed-out">
        <LoginPage />
      </Show>
      <Show when="signed-in">
        <Outlet />
      </Show>
    </>
  )
}

const router = createBrowserRouter([
  {
    path: '/sso-callback',
    element: <AuthenticateWithRedirectCallback />,
  },
  {
    path: '/',
    element: <AuthGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/pipeline" replace /> },
          {
            path: 'pipeline',
            element: <PipelinePage />,
            handle: { title: 'Pipeline', sub: 'Corporate Credit — Deal Pipeline · Confidential' },
          },
          {
            path: 'executive-summary',
            element: <ExecutiveSummaryPage />,
            handle: { title: 'Executive Summary', sub: 'Portfolio overview' },
          },
          {
            path: 'inbox',
            element: <InboxPage />,
            handle: {
              title: 'Inbox',
              sub: 'Proposed updates awaiting your review',
            },
          },
          {
            path: 'sponsors',
            element: <SponsorsPage />,
            handle: { title: 'Sponsors' },
          },
          {
            path: 'companies',
            element: <CompaniesPage />,
            handle: { title: 'Companies' },
          },
          {
            path: 'funds',
            element: <FundsPage />,
            handle: { title: 'Funds' },
          },
          {
            path: 'portfolio',
            element: <PortfolioPage />,
            handle: { title: 'Portfolio' },
          },
          {
            path: 'chat',
            element: <ChatPage />,
            handle: {
              title: 'Credit Co-Pilot',
              sub: 'Ask questions about the credit book',
              pinned: true,
            },
          },
          {
            path: 'logs',
            element: <LogsPage />,
            handle: { title: 'Logs', sub: 'Mailbox scans, deal updates, and outcomes' },
          },
          {
            path: 'analytics',
            element: <AnalyticsPage />,
            handle: { title: 'Analytics' },
          },
          {
            path: 'deals/:dealId',
            element: <DealDetailPage />,
            handle: { title: 'Deal' },
          },
          {
            path: 'deals/:dealId/:legacyTab',
            element: <LegacyDealTabRedirect />,
          },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
