import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  Navbar,
  NavbarButton,
  NavbarLogo,
  NavBody,
  NavItems,
} from '@/components/ui/resizable-navbar'

const navItems = [
  { name: 'Home', link: '#/' },
  { name: 'Demo Mode', link: '#/demo-mode' },
  { name: 'Docs', link: 'https://dsssp.io' }
]

function App() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <Navbar>
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="relative z-20 flex items-center gap-2">
            <NavbarButton href="https://github.com/numberonebot/dsssp">
              GitHub
            </NavbarButton>
            <NavbarButton href="#/demo-mode" variant="dark">
              Try Demo
            </NavbarButton>
          </div>
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
                className="text-sm font-medium text-neutral-700 dark:text-neutral-200"
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="flex w-full flex-col gap-2">
              <NavbarButton href="https://github.com/numberonebot/dsssp">
                GitHub
              </NavbarButton>
              <NavbarButton href="#/demo-mode" variant="dark">
                Try Demo
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  )
}

export default App
