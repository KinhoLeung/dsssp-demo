import '@fontsource/poppins/index.css'

import './utils/consoleProxy'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { createHashRouter, RouterProvider } from 'react-router-dom'

import App from './App.tsx'
import Changelog from './pages/Changelog.tsx'
import Device from './pages/Device.tsx'
import DemoMode from './pages/DemoMode.tsx'
import Docs from './pages/Docs.tsx'
import Home from './pages/Home.tsx'
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
        path: 'device',
        element: <Device />
      },
      {
        path: 'demo-mode',
        element: <DemoMode />
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
