import { describe, expect, it } from 'vitest'
import {
  log2TickValues,
  makeStepScale,
  makeValueScale,
  pow2Ceil,
  statsYMax,
} from './scales.ts'

describe('pow2Ceil', () => {
  it('rounds up to the next power of two', () => {
    expect(pow2Ceil(2)).toBe(2)
    expect(pow2Ceil(9232)).toBe(16384)
    expect(pow2Ceil(975400)).toBe(1048576)
    expect(pow2Ceil(1)).toBe(2)
  })
})

describe('makeValueScale', () => {
  it('maps the log2 domain monotonically and clamps below 1', () => {
    const scale = makeValueScale('log2', 9232, [400, 0])
    expect(scale(1)).toBe(400)
    expect(scale(16384)).toBe(0)
    expect(scale(2)).toBeGreaterThan(scale(4))
    expect(scale(0.5)).toBe(400)
    expect(scale(1e9)).toBe(0)
  })

  it('gives linear mode a zero baseline and clamps overshoot', () => {
    const scale = makeValueScale('linear', 9232, [400, 0])
    expect(scale(0)).toBe(400)
    expect(scale(-5)).toBe(400)
    const [d0, d1] = scale.domain()
    expect(d0).toBe(0)
    expect(d1).toBeGreaterThanOrEqual(9232)
  })
})

describe('makeStepScale', () => {
  it('spans step 0 to maxSteps across the range', () => {
    const scale = makeStepScale(111, [0, 555])
    expect(scale(0)).toBe(0)
    expect(scale(111)).toBe(555)
  })
})

describe('log2TickValues', () => {
  it('emits powers of two, ending at or past the maximum', () => {
    const ticks = log2TickValues(9232)
    expect(ticks[0]).toBe(1)
    for (const t of ticks) expect(Math.log2(t) % 1).toBe(0)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(9232)
    expect(ticks.length).toBeLessThanOrEqual(12)
  })

  it('widens the exponent step for huge maxima', () => {
    const ticks = log2TickValues(2 ** 50)
    expect(ticks.length).toBeLessThanOrEqual(12)
    expect(ticks[ticks.length - 1]).toBe(2 ** 50)
  })
})

describe('statsYMax', () => {
  it('exceeds the true maximum stopping time at every stop', () => {
    const trueMax: Record<number, number> = {
      1_000: 178,
      5_000: 237,
      10_000: 261,
      50_000: 323,
      100_000: 350,
      250_000: 442,
      500_000: 448,
      1_000_000: 524,
    }
    for (const [stop, max] of Object.entries(trueMax)) {
      expect(statsYMax(Number(stop))).toBeGreaterThan(max)
    }
  })
})
