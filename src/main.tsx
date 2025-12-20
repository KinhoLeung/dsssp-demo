import '@fontsource/poppins/index.css'

import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { createHashRouter, RouterProvider } from 'react-router-dom'

import '@/lib/theme'

import App from './App.tsx'
import RootLayout from './components/layout/RootLayout.tsx'
import ChangeLog from './pages/ChangeLog.tsx'
import DemoMode from './pages/DemoMode.tsx'

import './main.css'

function fallbackRender({ error }: { error: Error }) {
  return <pre style={{ padding: '8px', color: 'red' }}>{error.message}</pre>
}

function ContextMenuDisabler({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handler = (event: MouseEvent) => event.preventDefault()
    document.addEventListener('contextmenu', handler)
    return () => document.removeEventListener('contextmenu', handler)
  }, [])

  return children
}

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <App />
      },
      {
        path: '/changelog',
        element: <ChangeLog />
      },
      {
        path: '/DemoMode',
        element: <DemoMode />
      },
    ]
  }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContextMenuDisabler>
      <ErrorBoundary fallbackRender={fallbackRender}>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </ContextMenuDisabler>
  </StrictMode>
)
