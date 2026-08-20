export type ThemeName = 'light' | 'dark'

/* Structural subset of Element so the logic stays testable without a DOM. */
type ThemeRoot = Pick<Element, 'getAttribute' | 'setAttribute'>

const THEME_KEY = 'collatz-theme'

export function setTheme(theme: ThemeName, root: ThemeRoot = document.documentElement): void {
  root.setAttribute('data-theme', theme)
}

export function getTheme(root: ThemeRoot = document.documentElement): ThemeName {
  return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function systemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function storedTheme(storage: Pick<Storage, 'getItem'>): ThemeName | null {
  const value = storage.getItem(THEME_KEY)
  return value === 'dark' || value === 'light' ? value : null
}

/* A stored choice wins over the system preference at boot. */
export function initTheme(): void {
  setTheme(storedTheme(localStorage) ?? systemTheme())
}

export function toggleTheme(
  storage: Pick<Storage, 'setItem'> = localStorage,
  root: ThemeRoot = document.documentElement,
): ThemeName {
  const next: ThemeName = getTheme(root) === 'dark' ? 'light' : 'dark'
  setTheme(next, root)
  storage.setItem(THEME_KEY, next)
  return next
}

/* Canvas code cannot use CSS custom properties directly, so it reads the
   computed token values off the themed root element. */
export function readToken(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}
