import { useState } from 'react'
import { getTheme, toggleTheme, type ThemeName } from '../theme/theme.ts'

export function ThemeToggle() {
  const [theme, setThemeState] = useState<ThemeName>(() => getTheme())
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setThemeState(toggleTheme())}
    >
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
