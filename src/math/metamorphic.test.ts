import { describe, expect, it } from 'vitest'
import { stepOnce, trajectory } from './collatz.ts'
import { advanceStoppingRun, createStoppingRun } from './stoppingTimes.ts'
import { childrenOf, growCoral } from './tree.ts'

/*
 * Metamorphic relations: each test transforms an input in a known way and
 * checks that the output changes in the matching exact way. Golden values
 * pin a few points; these pin how the points relate to each other, which
 * is where off-by-one bounds, dropped parameters, and flipped comparisons
 * hide.
 */

/* Drives a run the way the stats view does, capped so a stall cannot hang. */
function runInChunks(N: number, quota: number) {
  const run = createStoppingRun(N)
  let calls = 0
  while (!run.done && calls < N) {
    advanceStoppingRun(run, quota)
    calls += 1
  }
  return { run, calls }
}

describe('stopping-time runs across N and quota', () => {
  it('restrict to the prefix n <= N for every N and chunking', () => {
    const { run: reference } = runInChunks(2_000, 2_000)
    /* 2, 27, 97 and 871 are record setters, so they sit on the boundary. */
    const cases = [
      [1, 1], [2, 5], [27, 1], [97, 10], [871, 64], [1_999, 333], [2_000, 7],
    ] as const
    for (const [N, quota] of cases) {
      const { run, calls } = runInChunks(N, quota)
      const records = reference.records.filter((r) => r.n <= N)
      const steps = reference.steps.slice(0, N + 1)
      expect(run.records).toEqual(records)
      expect(run.steps).toEqual(steps)
      expect(run.sumSteps).toBe(steps.reduce((sum, s) => sum + s, 0))
      expect(records.at(-1)).toEqual({ n: run.maxStepsN, steps: run.maxSteps })
      /* Each call consumes exactly its quota, so the call count is fixed too. */
      expect([run.done, calls]).toEqual([true, Math.ceil((N - 1) / quota)])
    }
  })
})

describe('trajectory started one step later', () => {
  it('drops exactly its first value, one step, and nothing else', () => {
    /*
     * From 2 up, since 1 is already home and has no tail. The long starts
     * cross the buffer growth, and 319804831 stops at the overflow guard.
     */
    const starts = Array.from({ length: 299 }, (_, i) => i + 2)
    for (const n of [...starts, 6171, 77031, 837799, 319804831]) {
      const whole = trajectory(n)
      const tail = trajectory(stepOnce(n))
      expect(tail.values).toEqual(whole.values.slice(1))
      expect(tail.steps).toBe(whole.steps - 1)
      expect(Math.max(n, tail.peak)).toBe(whole.peak)
      expect(tail.overflowed).toBe(whole.overflowed)
    }
  })
})

describe('reverse tree against the forward map', () => {
  it('holds exactly the preimages of stepOnce, with depth as step count', () => {
    /* From 2 up, since the tree drops the 4 -> 1 edge on purpose. */
    for (let n = 2; n <= 3_000; n += 1) {
      expect(childrenOf(stepOnce(n))).toContain(n)
      for (const child of childrenOf(n)) expect(stepOnce(child)).toBe(n)
    }
    const config = { evenAngleDeg: 8, oddAngleDeg: 20, maxDepth: 40, nodeBudget: 3_000 }
    const { nodes } = growCoral(config)
    /* The budget ends growth well before maxDepth, so the loop is never vacuous. */
    expect(nodes).toHaveLength(config.nodeBudget)
    for (const node of nodes.slice(1)) {
      expect(stepOnce(node.value)).toBe(nodes[node.parent]?.value)
      expect(node.depth).toBe(trajectory(node.value).steps)
    }
  })
})
