export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

const listeners = new Set<() => void>()

const emit = () => {
  listeners.forEach((listener) => listener())
}

const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
    ? 'dark'
    : 'light'
}

const readStoredTheme = (): Theme | null => {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

let currentTheme: Theme = readStoredTheme() ?? getSystemTheme()

applyThemeToDocument(currentTheme)

export const getTheme = (): Theme => currentTheme

export const setTheme = (theme: Theme) => {
  if (theme === currentTheme) return
  currentTheme = theme

  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore write failures
  }

  applyThemeToDocument(theme)
  emit()
}

export const toggleTheme = () => {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark')
}

export const subscribeTheme = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

