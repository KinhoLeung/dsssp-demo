import clsx from 'clsx'
import { useLocation } from 'react-router-dom'

import { useTheme } from '../../hooks/useTheme'

const navItems = [
  { href: '/demo1', label: 'Demo 1' },
  { href: '/demo2', label: 'Demo 2' },
  { href: '/demo3', label: 'Demo 3' },
  { href: '/demo4', label: 'Demo 4' },
  { href: '/demo5', label: 'Demo 5' }
]

const NavBar = () => {
  const location = useLocation()
  const currentPath = location.pathname
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="mt-8 flex items-center justify-center gap-4 font-[poppins,sans-serif] font-semibold text-lg text-center w-full">
      {navItems.map(({ href, label }) => (
        <a
          key={label}
          href={href.replace('/', '#')}
          className={clsx('text-zinc-700 hover:text-sky-600 dark:text-zinc-300', {
            'text-sky-600 dark:text-sky-400': href === currentPath
          })}
        >
          {label}
        </a>
      ))}

      <button
        type="button"
        onClick={toggleTheme}
        className="ml-2 rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-950"
        aria-label="Toggle theme"
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </nav>
  )
}

export default NavBar
