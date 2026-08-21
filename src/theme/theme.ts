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

/* Structural subset of MediaQueryList so the logic stays testable without a DOM. */
type SchemeQuery = {
  addEventListener: (type: 'change', listener: (event: { matches: boolean }) => void) => void
}

/* While no choice is stored, the app follows live OS theme changes (sunset
   auto-switch); a stored choice wins and the listener leaves it alone. */
export function watchSystemTheme(
  media: SchemeQuery = window.matchMedia('(prefers-color-scheme: dark)'),
  storage: Pick<Storage, 'getItem'> = localStorage,
  root: ThemeRoot = document.documentElement,
): void {
  media.addEventListener('change', (event) => {
    if (storedTheme(storage) === null) setTheme(event.matches ? 'dark' : 'light', root)
  })
}

export function toggleTheme(
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
  root: ThemeRoot = document.documentElement,
  system: ThemeName = systemTheme(),
): ThemeName {
  const next: ThemeName = getTheme(root) === 'dark' ? 'light' : 'dark'
  setTheme(next, root)
  /* Landing back on the system's own theme clears the stored choice, so the
     app resumes following the OS instead of freezing one answer forever. */
  if (next === system) storage.removeItem(THEME_KEY)
  else storage.setItem(THEME_KEY, next)
  return next
}

/* Canvas code cannot use CSS custom properties directly, so it reads the
   computed token values off the themed root element. */
export function readToken(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}
