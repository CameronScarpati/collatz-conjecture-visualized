import { describe, expect, it } from 'vitest'
import { getTheme, setTheme, storedTheme, toggleTheme } from './theme.ts'

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

  it('toggles and persists the choice', () => {
    const root = fakeRoot()
    const storage = fakeStorage()
    expect(toggleTheme(storage, root)).toBe('dark')
    expect(getTheme(root)).toBe('dark')
    expect(storedTheme(storage)).toBe('dark')
    expect(toggleTheme(storage, root)).toBe('light')
    expect(storedTheme(storage)).toBe('light')
  })
})
