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

  it('names the accepted range when it rejects a start', () => {
    /* MAX_START is 10^15, and String() prints it in full below 1e21. */
    expect(() => trajectory(0)).toThrow(
      /^start must be an integer between 1 and 1000000000000000$/,
    )
  })

  it('keeps every value when the sequence outgrows its first buffer', () => {
    /*
     * The buffer starts with 256 slots. 6171 takes 261 steps (OEIS
     * A006877) and 837799 takes 524, the most of any start below one
     * million, peaking at 2974984576 (cross-checked with arbitrary
     * precision). Their 262 and 525 values force one and two regrowths,
     * and each value must follow from the one before it by the map.
     */
    const cases = [
      { start: 6171, steps: 261, peak: 975400 },
      { start: 837799, steps: 524, peak: 2974984576 },
    ]
    for (const { start, steps, peak } of cases) {
      const t = trajectory(start)
      expect(t.steps).toBe(steps)
      expect(t.values.length).toBe(steps + 1)
      expect(t.peak).toBe(peak)
      expect(t.values[0]).toBe(start)
      expect(t.values[steps]).toBe(1)
      let prev = start
      for (const v of t.values.subarray(1)) {
        expect(v).toBe(prev % 2 === 0 ? prev / 2 : 3 * prev + 1)
        prev = v
      }
    }
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
    const last = t.values[t.values.length - 1]!
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

  it('ignores separators at either end of the field', () => {
    /* Splitting on the edge separators leaves empty tokens to drop. */
    expect(parseStarts(' 27, 97 ', 8)).toEqual({ starts: [27, 97] })
    expect(parseStarts(',\n27\t', 8)).toEqual({ starts: [27] })
  })

  it('explains each kind of rejection in words', () => {
    expect(parseStarts('   ', 8)).toEqual({
      error: 'Enter at least one starting number.',
    })
    expect(parseStarts('27, banana', 8)).toEqual({
      error: '"banana" is not a whole number between 1 and 10^15.',
    })
    expect(parseStarts('1 2 3 4 5 6 7 8 9', 8)).toEqual({
      error: 'At most 8 starting numbers at a time.',
    })
  })
})
