'use client'

import { useState } from 'react'

import LineMdMoonAltToSunnyOutlineLoopTransitionIcon from '@/assets/LineMdMoonAltToSunnyOutlineLoopTransition.svg?react'
import LineMdSunnyOutlineToMoonAltLoopTransitionIcon from '@/assets/LineMdSunnyOutlineToMoonAltLoopTransition.svg?react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  NavItems,
  Navbar,
  NavbarLogo,
} from '@/components/ui/resizable-navbar'
import { cn } from '@/lib/utils'

const navItems = [
  {
    name: 'Docs',
    link: '#docs',
  },
  {
    name: 'Changelog',
    link: '#/changelog',
  },
]

const AppNavbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [language, setLanguage] = useState<'en' | 'cn'>('en')

  const toggleLanguage = () => {
    setLanguage((current) => (current === 'en' ? 'cn' : 'en'))
  }

  const languageLabel = language === 'en' ? 'EN' : 'CN'

  return (
    <Navbar>
      <NavBody>
        <NavbarLogo />
        <NavItems items={navItems} />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={toggleLanguage}
            aria-label="Toggle language"
            size="icon"
            className="rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            {languageLabel}
          </Button>
          <AnimatedThemeToggler
            aria-label="Toggle theme"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              'rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800'
            )}
            iconLight={
              <LineMdSunnyOutlineToMoonAltLoopTransitionIcon className="h-5 w-5" />
            }
            iconDark={
              <LineMdMoonAltToSunnyOutlineLoopTransitionIcon className="h-5 w-5" />
            }
          />
        </div>
      </NavBody>
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={toggleLanguage}
              aria-label="Toggle language"
              size="icon"
              className="rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              {languageLabel}
            </Button>
            <AnimatedThemeToggler
              aria-label="Toggle theme"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800'
              )}
              iconLight={
                <LineMdSunnyOutlineToMoonAltLoopTransitionIcon className="h-5 w-5" />
              }
              iconDark={
                <LineMdMoonAltToSunnyOutlineLoopTransitionIcon className="h-5 w-5" />
              }
            />
            <MobileNavToggle
              isOpen={isOpen}
              onClick={() => setIsOpen((open) => !open)}
            />
          </div>
        </MobileNavHeader>
        <MobileNavMenu
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        >
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.link}
              className="text-sm font-medium text-neutral-700 dark:text-neutral-200"
              onClick={() => setIsOpen(false)}
            >
              {item.name}
            </a>
          ))}
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  )
}

export default AppNavbar
