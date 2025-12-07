import clsx from 'clsx'
import { useLocation } from 'react-router-dom'

const navItems = [{ href: '/', label: 'Demo 1' }]

const NavBar = () => {
  const location = useLocation()
  const currentPath = location.pathname
  return (
    <nav className="mt-8 space-x-4 font-[poppins,sans-serif] font-semibold text-lg text-center w-full">
      {navItems.map(({ href, label }) => (
        <a
          key={label}
          href={href.replace('/', '#')}
          className={clsx('hover:text-sky-600', {
            'text-sky-400': href === currentPath
          })}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}

export default NavBar
