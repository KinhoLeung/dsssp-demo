import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  Navbar,
  NavbarLanguageToggle,
  NavbarLogo,
  NavBody,
  NavItems,
} from '@/components/ui/resizable-navbar'
import { Toaster } from '@/components/ui/toaster'
import { DeviceSessionProvider } from '@/device/session/deviceSessionContext'

function App() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useTranslation()

  const navItems = [
    { name: t('nav.docs'), link: '#/docs' },
    { name: t('nav.changelog'), link: '#/changelog' },
  ]

  return (
    <div className="min-h-screen" onContextMenuCapture={(e) => e.preventDefault()}>
      <Navbar>
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="relative z-20 flex items-center gap-2">
            <NavbarLanguageToggle />
          </div>
        </NavBody>

        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <div className="flex items-center gap-2">
              <NavbarLanguageToggle />
              <MobileNavToggle
                isOpen={isOpen}
                onClick={() => setIsOpen((open) => !open)}
              />
            </div>
          </MobileNavHeader>
          <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
            {navItems.map((item) => (
              <a
                key={item.link}
                href={item.link}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </a>
            ))}
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <DeviceSessionProvider>
          <Outlet />
        </DeviceSessionProvider>
      </main>
      <Toaster />
    </div>
  )
}

export default App
