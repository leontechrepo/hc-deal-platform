import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Show, AuthenticateWithRedirectCallback, useAuth } from '@clerk/react'
import { NavProvider } from './NavContext'
import { NavBar } from './components/NavBar/NavBar'
import shell from './components/AppShell/AppShell.module.css'
import { PipelinePage } from './pages/PipelinePage/PipelinePage'
import { LogsPage } from './pages/LogsPage/LogsPage'
import { AnalyticsPage } from './pages/AnalyticsPage/AnalyticsPage'
import { SponsorsPage } from './pages/SponsorsPage/SponsorsPage'
import { FundsPage } from './pages/FundsPage/FundsPage'
import { PortfolioPage } from './pages/PortfolioPage/PortfolioPage'
import { InboxPage } from './pages/InboxPage/InboxPage'
import { ExecutiveSummaryPage } from './pages/ExecutiveSummaryPage/ExecutiveSummaryPage'
import { ChatPage } from './pages/ChatPage/ChatPage'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { DealDetailPage } from './pages/DealDetailPage/DealDetailPage'
import { OverviewTab } from './pages/DealDetailPage/tabs/OverviewTab'
import { UnderwritingTab } from './pages/DealDetailPage/tabs/UnderwritingTab'
import { TimelineTab } from './pages/DealDetailPage/tabs/TimelineTab'
import { FormulasTab } from './pages/DealDetailPage/tabs/FormulasTab'
import { ActivityTab } from './pages/DealDetailPage/tabs/ActivityTab'
import { NotesTab } from './pages/DealDetailPage/tabs/NotesTab'
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
  return (
    <div className={shell.appShell}>
      <NavBar />
      <main className={shell.mainArea}>
        <Routes>
          <Route path="/" element={<Navigate to="/pipeline" replace />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/executive-summary" element={<ExecutiveSummaryPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/sponsors" element={<SponsorsPage />} />
          <Route path="/funds" element={<FundsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/deals/:dealId" element={<DealDetailPage />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OverviewTab />} />
            <Route path="underwriting" element={<UnderwritingTab />} />
            <Route path="timeline" element={<TimelineTab />} />
            <Route path="formulas" element={<FormulasTab />} />
            <Route path="activity" element={<ActivityTab />} />
            <Route path="notes" element={<NotesTab />} />
          </Route>
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
