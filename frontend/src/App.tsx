import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Show, AuthenticateWithRedirectCallback, useAuth } from '@clerk/react'
import { NavProvider, useNav } from './NavContext'
import { NavBar } from './components/NavBar/NavBar'
import { DashboardPage } from './pages/DashboardPage/DashboardPage'
import { LogsPage } from './pages/LogsPage/LogsPage'
import { AnalyticsPage } from './pages/AnalyticsPage/AnalyticsPage'
import { SponsorsPage } from './pages/SponsorsPage/SponsorsPage'
import { FundsPage } from './pages/FundsPage/FundsPage'
import { PortfolioPage } from './pages/PortfolioPage/PortfolioPage'
import { InboxPage } from './pages/InboxPage/InboxPage'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { registerTokenGetter } from './api/client'

function AuthBridge() {
  const { getToken } = useAuth()
  useEffect(() => {
    registerTokenGetter(() => getToken())
    return () => registerTokenGetter(null)
  }, [getToken])
  return null
}

function Layout() {
  const { collapsed } = useNav()
  const navWidth = collapsed ? 'var(--nav-width-collapsed)' : 'var(--nav-width-expanded)'

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <NavBar />
      <main style={{
        marginLeft: navWidth,
        flex: 1,
        minHeight: '100vh',
        overflowY: 'auto',
        transition: 'margin-left 0.22s ease',
      }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/sponsors" element={<SponsorsPage />} />
          <Route path="/funds" element={<FundsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/inbox" element={<InboxPage />} />
        </Routes>
      </main>
    </div>
  )
}

function AuthGate() {
  return (
    <>
      <AuthBridge />
      <Show when="signed-out">
        <LoginPage />
      </Show>
      <Show when="signed-in">
        <NavProvider>
          <Layout />
        </NavProvider>
      </Show>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />
        <Route path="*" element={<AuthGate />} />
      </Routes>
    </BrowserRouter>
  )
}
