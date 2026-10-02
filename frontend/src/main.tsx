import { ClerkProvider } from '@clerk/react'
import { ThemeProvider, THEME_STORAGE_KEY } from '@leontechrepo/leon-ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast/Toast'
import { DealExtractionProvider } from './context/DealExtractionContext'
import App from './App.tsx'
import './index.css'

const OLD_THEME_KEY = 'theme'
try {
  const oldTheme = localStorage.getItem(OLD_THEME_KEY)
  if (oldTheme && !localStorage.getItem(THEME_STORAGE_KEY)) {
    localStorage.setItem(THEME_STORAGE_KEY, oldTheme)
  }
} catch {
  // storage blocked
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <DealExtractionProvider>
              <App />
            </DealExtractionProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  </StrictMode>,
)
