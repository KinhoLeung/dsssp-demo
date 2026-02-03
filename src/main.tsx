import '@fontsource/poppins/index.css'

import './utils/consoleProxy'
import 'dsssp/font'
import './locales/i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { createHashRouter, RouterProvider } from 'react-router-dom'

import App from './App.tsx'
import { startAntiDebug } from './utils/security'

// 启动反调试防护
startAntiDebug();

import Changelog from './pages/Changelog.tsx'
import DemoMode from './pages/DemoMode.tsx'
import DeviceDemo from './pages/DeviceDemo.tsx'
import Docs from './pages/Docs.tsx'
import Home from './pages/Home.tsx'
import NotFound from './pages/NotFound.tsx'
import { RequireDeviceReady } from './routes/RequireDeviceReady.tsx'
import './main.css'

function fallbackRender({ error }: { error: Error }) {
  return <pre style={{ padding: '8px', color: 'red' }}>{error.message}</pre>
}

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
        element: <Docs />
      },
      {
        path: 'changelog',
        element: <Changelog />
      },
      {
        path: 'device-demo',
        element: (
          <RequireDeviceReady>
            <DeviceDemo />
          </RequireDeviceReady>
        )
      },
      {
        path: 'demo-mode',
        element: <DemoMode />
      },
      {
        path: '*',
        element: <NotFound />
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
