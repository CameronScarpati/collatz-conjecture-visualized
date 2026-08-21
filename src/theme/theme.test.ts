import { describe, expect, it } from 'vitest'
import { getTheme, setTheme, storedTheme, toggleTheme, watchSystemTheme } from './theme.ts'

function fakeRoot() {
  const attrs = new Map<string, string>()
  return {
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      attrs.set(name, value)
    },
  }
}

function fakeStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

describe('theme', () => {
  it('defaults to light when no data-theme is set', () => {
    expect(getTheme(fakeRoot())).toBe('light')
  })

  it('round-trips the data-theme attribute', () => {
    const root = fakeRoot()
    setTheme('dark', root)
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(getTheme(root)).toBe('dark')
    setTheme('light', root)
    expect(getTheme(root)).toBe('light')
  })

  it('reads only valid stored themes', () => {
    const storage = fakeStorage()
    expect(storedTheme(storage)).toBeNull()
    storage.setItem('collatz-theme', 'dark')
    expect(storedTheme(storage)).toBe('dark')
    storage.setItem('collatz-theme', 'purple')
    expect(storedTheme(storage)).toBeNull()
  })

  it('toggles and persists while the choice differs from the system theme', () => {
    const root = fakeRoot()
    const storage = fakeStorage()
    expect(toggleTheme(storage, root, 'light')).toBe('dark')
    expect(getTheme(root)).toBe('dark')
    expect(storedTheme(storage)).toBe('dark')
  })

  it('clears the stored choice when a toggle lands on the system theme', () => {
    const root = fakeRoot()
    const storage = fakeStorage()
    expect(toggleTheme(storage, root, 'light')).toBe('dark')
    expect(storedTheme(storage)).toBe('dark')
    expect(toggleTheme(storage, root, 'light')).toBe('light')
    expect(storedTheme(storage)).toBeNull()
  })

  it('follows live system changes only while no choice is stored', () => {
    const root = fakeRoot()
    const storage = fakeStorage()
    let fire: (event: { matches: boolean }) => void = () => {}
    const media = {
      addEventListener: (_type: 'change', listener: (event: { matches: boolean }) => void) => {
        fire = listener
      },
    }
    watchSystemTheme(media, storage, root)
    fire({ matches: true })
    expect(getTheme(root)).toBe('dark')
    storage.setItem('collatz-theme', 'light')
    fire({ matches: true })
    expect(getTheme(root)).toBe('dark')
    fire({ matches: false })
    expect(getTheme(root)).toBe('dark')
  })
})
