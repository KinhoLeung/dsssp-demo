import { Moon, Sun } from 'lucide-react'
import {
  useCallback,
  useRef,
  type ReactNode,
  type ComponentPropsWithoutRef,
} from 'react'
import { flushSync } from 'react-dom'

import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface AnimatedThemeTogglerProps
  extends ComponentPropsWithoutRef<'button'> {
  duration?: number
  iconLight?: ReactNode
  iconDark?: ReactNode
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  iconLight,
  iconDark,
  ...props
}: AnimatedThemeTogglerProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  const toggleTheme = useCallback(async () => {
    if (!buttonRef.current) return

    const nextTheme = isDark ? 'light' : 'dark'
    const applyTheme = () => {
      flushSync(() => {
        setTheme(nextTheme)
      })
    }

    if ('startViewTransition' in document) {
      await document.startViewTransition(applyTheme).ready
    } else {
      applyTheme()
      return
    }

    const { top, left, width, height } =
      buttonRef.current.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const maxRadius = Math.hypot(
      Math.max(left, window.innerWidth - left),
      Math.max(top, window.innerHeight - top)
    )

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    )
  }, [isDark, setTheme, duration])

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(className)}
      {...props}
    >
      {isDark ? iconDark ?? <Sun /> : iconLight ?? <Moon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
