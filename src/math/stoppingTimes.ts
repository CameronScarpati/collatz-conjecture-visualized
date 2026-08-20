/*
 * Total stopping times for every n up to N, computed with the classic
 * Collatz memoization: n ascends, so a trajectory only needs to be walked
 * until it first dips below its own start, where the answer is already
 * known. The walk is resumable in bounded quotas so the caller can spread
 * a million starts across animation frames without blocking the UI.
 */

export interface StoppingRecord {
  n: number
  steps: number
}

export interface StoppingRun {
  N: number
  /* Next start to compute; the run is done when this passes N. */
  next: number
  /*
   * steps[n] is the total stopping time of n. Uint16 holds every value
   * this app allows: the maximum below one million is 524 (at 837799).
   */
  steps: Uint16Array
  /* Every n whose stopping time beats all smaller starts, in order. */
  records: StoppingRecord[]
  maxSteps: number
  maxStepsN: number
  sumSteps: number
  done: boolean
}

export function createStoppingRun(N: number): StoppingRun {
  return {
    N,
    next: 2,
    steps: new Uint16Array(N + 1),
    records: [{ n: 1, steps: 0 }],
    maxSteps: 0,
    maxStepsN: 1,
    sumSteps: 0,
    done: N < 2,
  }
}

/*
 * Computes up to `quota` further starts. Quota-based rather than
 * deadline-based so results are reproducible in tests; the caller times
 * repeated small quotas against its own frame budget.
 */
export function advanceStoppingRun(run: StoppingRun, quota: number): void {
  const { steps, N } = run
  let n = run.next
  const stop = Math.min(N, n + quota - 1)

  while (n <= stop) {
    /*
     * Walk until the value first drops below n. Every smaller value is
     * already memoized because starts ascend. Intermediates stay far
     * below 2^53 for N up to one million, so no overflow branch is
     * needed in this loop (the largest excursion is near 5.7e13).
     */
    let m = n
    let count = 0
    while (m >= n) {
      m = m % 2 === 0 ? m / 2 : 3 * m + 1
      count += 1
    }
    const total = count + steps[m]
    steps[n] = total
    run.sumSteps += total
    if (total > run.maxSteps) {
      run.maxSteps = total
      run.maxStepsN = n
      run.records.push({ n, steps: total })
    }
    n += 1
  }

  run.next = n
  if (n > N) run.done = true
}

export interface Histogram {
  bins: Uint32Array
  binWidth: number
  maxCount: number
  modalBin: number
}

/* Counts of stopping times over [0, maxSteps], binned by binWidth. */
export function buildHistogram(run: StoppingRun, binWidth = 5): Histogram {
  const bins = new Uint32Array(Math.floor(run.maxSteps / binWidth) + 1)
  for (let n = 1; n <= run.N; n += 1) {
    bins[Math.floor(run.steps[n] / binWidth)] += 1
  }
  let maxCount = 0
  let modalBin = 0
  for (let i = 0; i < bins.length; i += 1) {
    if (bins[i] > maxCount) {
      maxCount = bins[i]
      modalBin = i
    }
  }
  return { bins, binWidth, maxCount, modalBin }
}
