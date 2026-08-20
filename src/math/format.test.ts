import { describe, expect, it } from 'vitest'
import { formatInt, formatPow2, formatTickLinear, formatValue } from './format.ts'

describe('formatInt', () => {
  it('groups thousands', () => {
    expect(formatInt(9232)).toBe('9,232')
    expect(formatInt(975400)).toBe('975,400')
    expect(formatInt(7)).toBe('7')
  })
})

describe('formatTickLinear', () => {
  it('keeps small values exact and compacts large ones', () => {
    expect(formatTickLinear(0)).toBe('0')
    expect(formatTickLinear(250)).toBe('250')
    expect(formatTickLinear(1_000)).toBe('1k')
    expect(formatTickLinear(250_000)).toBe('250k')
    expect(formatTickLinear(1_000_000)).toBe('1M')
    expect(formatTickLinear(2_500_000)).toBe('2.5M')
    expect(formatTickLinear(1_000_000_000)).toBe('1e9')
  })
})

describe('formatPow2', () => {
  it('spells small powers as numbers and large ones as powers', () => {
    expect(formatPow2(1)).toBe('1')
    expect(formatPow2(32)).toBe('32')
    expect(formatPow2(512)).toBe('512')
    expect(formatPow2(1024)).toBe('2¹⁰')
    expect(formatPow2(16384)).toBe('2¹⁴')
  })
})

describe('formatValue', () => {
  it('groups while short and goes exponential once long', () => {
    expect(formatValue(9232)).toBe('9,232')
    expect(formatValue(975400)).toBe('975,400')
    expect(formatValue(1414236446719942)).toBe('1.41e15')
    expect(formatValue(Number.NaN)).toBe('n/a')
  })
})
