import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  Navbar,
  NavbarLogo,
  NavBody,
  NavItems,
} from '@/components/ui/resizable-navbar'
import { DeviceSessionProvider } from '@/device/session/deviceSessionContext'

const navItems = [
  { name: 'Docs', link: '#/docs' },
  { name: 'Changelog', link: '#/changelog' }
]

function App() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <Navbar>
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="relative z-20 flex items-center gap-2" />
        </NavBody>

        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle
              isOpen={isOpen}
              onClick={() => setIsOpen((open) => !open)}
            />
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
    </div>
  )
}

export default App
