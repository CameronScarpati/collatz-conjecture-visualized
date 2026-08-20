import { describe, expect, it } from 'vitest'
import {
  MAX_START,
  OVERFLOW_LIMIT,
  isValidStart,
  parseStarts,
  stepOnce,
  trajectory,
} from './collatz.ts'

describe('trajectory', () => {
  it('treats 1 as already home, with zero steps', () => {
    const t = trajectory(1)
    expect(Array.from(t.values)).toEqual([1])
    expect(t.steps).toBe(0)
    expect(t.peak).toBe(1)
    expect(t.overflowed).toBe(false)
  })

  it('produces the golden sequence for 6', () => {
    const t = trajectory(6)
    expect(Array.from(t.values)).toEqual([6, 3, 10, 5, 16, 8, 4, 2, 1])
    expect(t.steps).toBe(8)
    expect(t.peak).toBe(16)
  })

  it('gives 27 its famous 111 steps and 9232 peak', () => {
    const t = trajectory(27)
    expect(t.steps).toBe(111)
    expect(t.values.length).toBe(112)
    expect(t.peak).toBe(9232)
    expect(t.values[t.values.length - 1]).toBe(1)
  })

  it('matches known stopping times and peaks for record setters', () => {
    expect(trajectory(97).steps).toBe(118)
    expect(trajectory(97).peak).toBe(9232)
    expect(trajectory(871).steps).toBe(178)
    expect(trajectory(871).peak).toBe(190996)
    expect(trajectory(6171).steps).toBe(261)
    expect(trajectory(6171).peak).toBe(975400)
  })

  it('walks powers of two straight down in exactly k steps', () => {
    for (let k = 1; k <= 20; k += 1) {
      const t = trajectory(2 ** k)
      expect(t.steps).toBe(k)
      expect(t.peak).toBe(2 ** k)
    }
  })

  it('rejects zero, negatives, fractions, and values past the cap', () => {
    expect(() => trajectory(0)).toThrow(RangeError)
    expect(() => trajectory(-5)).toThrow(RangeError)
    expect(() => trajectory(1.5)).toThrow(RangeError)
    expect(() => trajectory(MAX_START + 1)).toThrow(RangeError)
    expect(isValidStart(MAX_START)).toBe(true)
  })

  it('stops and reports instead of stepping past the safe range', () => {
    /*
     * 319804831 is a known maximum-excursion record holder whose true
     * peak, 1414236446719942480, is far past 2^53. Verified against
     * arbitrary-precision arithmetic: the first odd value above
     * OVERFLOW_LIMIT arrives at step 129 and is 3827712881638043.
     */
    const t = trajectory(319804831)
    expect(t.overflowed).toBe(true)
    expect(t.steps).toBe(129)
    const last = t.values[t.values.length - 1]
    expect(last).toBe(3827712881638043)
    expect(last % 2).toBe(1)
    expect(last).toBeGreaterThan(OVERFLOW_LIMIT)
    for (const v of t.values) {
      expect(v).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER)
    }
  })
})

describe('stepOnce', () => {
  it('halves evens and applies 3n+1 to odds', () => {
    expect(stepOnce(10)).toBe(5)
    expect(stepOnce(5)).toBe(16)
    expect(stepOnce(1)).toBe(4)
  })
})

describe('parseStarts', () => {
  it('splits on commas and whitespace and de-duplicates in order', () => {
    expect(parseStarts('27, 97 871,, 27', 8)).toEqual({ starts: [27, 97, 871] })
  })

  it('rejects empty input, junk tokens, and over-limit lists', () => {
    expect(parseStarts('   ', 8)).toHaveProperty('error')
    expect(parseStarts('27, banana', 8)).toHaveProperty('error')
    expect(parseStarts('3.5', 8)).toHaveProperty('error')
    expect(parseStarts('0', 8)).toHaveProperty('error')
    expect(parseStarts('1 2 3 4 5 6 7 8 9', 8)).toHaveProperty('error')
    expect(parseStarts('1 2 3 4 5 6 7 8', 8)).toEqual({
      starts: [1, 2, 3, 4, 5, 6, 7, 8],
    })
  })
})
