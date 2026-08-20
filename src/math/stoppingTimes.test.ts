import { describe, expect, it } from 'vitest'
import {
  advanceStoppingRun,
  buildHistogram,
  createStoppingRun,
} from './stoppingTimes.ts'

function completedRun(N: number) {
  const run = createStoppingRun(N)
  advanceStoppingRun(run, N)
  return run
}

describe('stopping-time runs', () => {
  it('memoizes correct totals for known values at N = 100', () => {
    const run = completedRun(100)
    expect(run.done).toBe(true)
    expect(run.steps[1]).toBe(0)
    expect(run.steps[2]).toBe(1)
    expect(run.steps[6]).toBe(8)
    expect(run.steps[27]).toBe(111)
    expect(run.steps[97]).toBe(118)
  })

  it('finds exactly the record setters below 100 (OEIS A006877)', () => {
    const run = completedRun(100)
    expect(run.records.map((r) => r.n)).toEqual([
      1, 2, 3, 6, 7, 9, 18, 25, 27, 54, 73, 97,
    ])
    expect(run.records.map((r) => r.steps)).toEqual([
      0, 1, 7, 8, 16, 19, 20, 23, 111, 112, 115, 118,
    ])
  })

  it('ends the record list at 6171 with 261 steps for N = 10000', () => {
    const run = completedRun(10_000)
    const last = run.records[run.records.length - 1]
    expect(last).toEqual({ n: 6171, steps: 261 })
    expect(run.maxSteps).toBe(261)
    expect(run.maxStepsN).toBe(6171)
  })

  it('peaks at 350 steps for n = 77031 below 100000', () => {
    const run = completedRun(100_000)
    expect(run.maxSteps).toBe(350)
    expect(run.maxStepsN).toBe(77031)
  })

  it('produces identical results in small quotas and in one pass', () => {
    const oneShot = completedRun(5_000)
    const chunked = createStoppingRun(5_000)
    while (!chunked.done) advanceStoppingRun(chunked, 137)
    expect(chunked.steps).toEqual(oneShot.steps)
    expect(chunked.records).toEqual(oneShot.records)
    expect(chunked.sumSteps).toBe(oneShot.sumSteps)
  })

  it('tracks the running mean input soundly', () => {
    const run = completedRun(1_000)
    let sum = 0
    for (let n = 1; n <= 1_000; n += 1) sum += run.steps[n]
    expect(run.sumSteps).toBe(sum)
  })
})

describe('buildHistogram', () => {
  it('bins every n exactly once', () => {
    const run = completedRun(10_000)
    const histogram = buildHistogram(run)
    let total = 0
    for (const count of histogram.bins) total += count
    expect(total).toBe(10_000)
  })

  it('places 27 in a nonzero bin and finds a sensible mode', () => {
    const run = completedRun(1_000)
    const histogram = buildHistogram(run)
    expect(histogram.bins[Math.floor(run.steps[27] / histogram.binWidth)]).toBeGreaterThan(0)
    expect(histogram.bins[histogram.modalBin]).toBe(histogram.maxCount)
    expect(histogram.maxCount).toBeGreaterThan(0)
  })
})
