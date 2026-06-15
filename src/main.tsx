import '@fontsource/poppins/index.css'

import './utils/consoleProxy'
import './locales/i18n'

import { Suspense, StrictMode, lazy, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { createHashRouter, RouterProvider } from 'react-router-dom'

import App from './App.tsx'
import Home from './pages/Home.tsx'
import { RequireDeviceReady } from './routes/RequireDeviceReady.tsx'
import { startAntiDebug } from './utils/security'
import './main.css'

const Changelog = lazy(() => import('./pages/Changelog.tsx'))
const DemoMode = lazy(() => import('./pages/DemoMode.tsx'))
const DeviceDemo = lazy(() => import('./pages/DeviceDemo.tsx'))
const Docs = lazy(() => import('./pages/Docs.tsx'))
const NotFound = lazy(() => import('./pages/NotFound.tsx'))

function fallbackRender({ error }: { error: Error }) {
  return <pre style={{ padding: '8px', color: 'red' }}>{error.message}</pre>
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading...
    </div>
  )
}

function withRouteSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

// 启动反调试防护
startAntiDebug()

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'docs',
        element: withRouteSuspense(<Docs />)
      },
      {
        path: 'changelog',
        element: withRouteSuspense(<Changelog />)
      },
      {
        path: 'device-demo',
        element: withRouteSuspense(
          <RequireDeviceReady>
            <DeviceDemo />
          </RequireDeviceReady>
        )
      },
      {
        path: 'demo-mode',
        element: withRouteSuspense(<DemoMode />)
      },
      {
        path: '*',
        element: withRouteSuspense(<NotFound />)
      }
    ]
  }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackRender={fallbackRender}>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>
)
