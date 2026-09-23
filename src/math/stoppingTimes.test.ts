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
    for (let n = 1; n <= 1_000; n += 1) sum += run.steps[n]!
    expect(run.sumSteps).toBe(sum)
  })

  it('starts done only when there is nothing past n = 1 to compute', () => {
    expect(createStoppingRun(1).done).toBe(true)
    const run = createStoppingRun(2)
    expect(run.done).toBe(false)
    advanceStoppingRun(run, 1)
    expect(run.done).toBe(true)
    /* 2 -> 1 is one step, which beats the zero steps of n = 1. */
    expect(run.steps[2]).toBe(1)
    expect(run.records).toEqual([
      { n: 1, steps: 0 },
      { n: 2, steps: 1 },
    ])
  })

  it('computes exactly quota starts per call', () => {
    /*
     * From next = 2, a quota of 10 covers starts 2 through 11. 11 takes
     * 14 steps (11 34 17 52 26 13 40 20 10 5 16 8 4 2 1), and 12 must
     * still be untouched.
     */
    const run = createStoppingRun(100)
    advanceStoppingRun(run, 10)
    expect(run.next).toBe(12)
    expect(run.done).toBe(false)
    expect(run.steps[11]).toBe(14)
    expect(run.steps[12]).toBe(0)
  })

  it('is not done until N itself has been computed', () => {
    /* Starts 2 through 9 leave next at N = 10, which is still owed. */
    const run = createStoppingRun(10)
    advanceStoppingRun(run, 8)
    expect(run.next).toBe(10)
    expect(run.done).toBe(false)
    advanceStoppingRun(run, 8)
    expect(run.next).toBe(11)
    expect(run.done).toBe(true)
    /* 10 5 16 8 4 2 1 is six steps. */
    expect(run.steps[10]).toBe(6)
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
    expect(histogram.bins[Math.floor(run.steps[27]! / histogram.binWidth)]).toBeGreaterThan(0)
    expect(histogram.bins[histogram.modalBin]).toBe(histogram.maxCount)
    expect(histogram.maxCount).toBeGreaterThan(0)
  })

  it('bins the first ten starts to match hand-counted stopping times', () => {
    /*
     * Stopping times for n = 1 to 10 are 0 1 7 2 5 8 16 3 19 6, so the
     * max is 19 and width-5 bins [0,5) [5,10) [10,15) [15,20) hold
     * 4 4 0 2. Bins 0 and 1 tie at 4, and the mode is the first of them.
     */
    const run = completedRun(10)
    const histogram = buildHistogram(run)
    expect(Array.from(histogram.bins)).toEqual([4, 4, 0, 2])
    expect(histogram.maxCount).toBe(4)
    expect(histogram.modalBin).toBe(0)
    /* Width 10 folds them into [0,10) and [10,20), holding 8 and 2. */
    expect(Array.from(buildHistogram(run, 10).bins)).toEqual([8, 2])
    /*
     * Width 19 divides the max exactly, so the max opens a bin of its
     * own: [0,19) holds the other nine and [19,38) holds only n = 9.
     */
    expect(Array.from(buildHistogram(run, 19).bins)).toEqual([9, 1])
  })

  it('gives the default view a last bin that holds only its max', () => {
    /*
     * Below 100000 the max is 350 steps, reached only by 77031. That is
     * a multiple of the default width 5, so 350 / 5 + 1 = 71 bins.
     */
    const histogram = buildHistogram(completedRun(100_000))
    expect(histogram.bins.length).toBe(71)
    expect(histogram.bins[70]).toBe(1)
  })
})
