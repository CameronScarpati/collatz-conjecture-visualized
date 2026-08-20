/*
 * Single source of truth for view configuration: types, defaults,
 * presets, and the UI bounds the controls and tests both read.
 */

export type ViewId = 'trajectories' | 'tree' | 'stats'

export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'trajectories', label: 'Trajectories' },
  { id: 'tree', label: 'Tree' },
  { id: 'stats', label: 'Statistics' },
]

/* Deep links: #trajectories, #tree, #stats. */
export function viewFromHash(hash: string): ViewId | null {
  const id = hash.replace(/^#/, '')
  return VIEWS.some((view) => view.id === id) ? (id as ViewId) : null
}

/* ---------- Trajectory explorer ---------- */

export type TrajectoryMode = 'list' | 'range'
export type YMode = 'log2' | 'linear'

export interface TrajectoryConfig {
  mode: TrajectoryMode
  /* Explicit starting numbers, list mode. */
  starts: number[]
  /* Every start from 1 to rangeN, range mode. */
  rangeN: number
  yMode: YMode
  stepsPerSecond: number
}

export const MAX_LIST_STARTS = 8
export const MAX_RANGE_N = 2000
export const SPEED_STOPS = [2, 5, 10, 25, 50, 100]

export const DEFAULT_TRAJECTORY: TrajectoryConfig = {
  mode: 'list',
  starts: [27],
  rangeN: 100,
  yMode: 'log2',
  stepsPerSecond: 10,
}

export interface Preset<T> {
  label: string
  note: string
  config: T
}

export const TRAJECTORY_PRESETS: Preset<TrajectoryConfig>[] = [
  {
    label: 'The famous 27',
    note: 'From a two digit start, 111 steps and a peak of 9,232 before it comes home.',
    config: { ...DEFAULT_TRAJECTORY },
  },
  {
    label: 'Record breakers',
    note: 'Each start sets a new stopping time record: 111, 118, 178, then 261 steps.',
    config: { ...DEFAULT_TRAJECTORY, starts: [27, 97, 871, 6171], stepsPerSecond: 25 },
  },
  {
    label: 'Powers of two',
    note: 'Halving is the only move, so the log scale shows straight parallel descents.',
    config: { ...DEFAULT_TRAJECTORY, starts: [16, 64, 256, 1024, 4096] },
  },
  {
    label: 'Neighbors diverge',
    note: '26 lands in 10 steps and 28 in 18, while 27 wanders for 111.',
    config: { ...DEFAULT_TRAJECTORY, starts: [26, 27, 28] },
  },
  {
    label: 'The first thousand',
    note: 'Every start up to 1,000 racing at once, with the record holder highlighted.',
    config: { ...DEFAULT_TRAJECTORY, mode: 'range', rangeN: 1000, stepsPerSecond: 25 },
  },
]

export interface TrajectoryReadout {
  step: number
  branches: number
  /* Branches whose trajectory is still in flight at the current step. */
  running: number
  /* Longest finished branch so far, so the race stays unspoiled. */
  longestN: number
  longestSteps: number
  peakN: number
  peakValue: number
  overflowed: number
  done: boolean
}

/* ---------- Reverse tree coral ---------- */

export interface TreeConfig {
  evenAngleDeg: number
  oddAngleDeg: number
  maxDepth: number
  levelsPerSecond: number
  labelSmall: boolean
}

export const TREE_BOUNDS = {
  evenAngleDeg: { min: 0, max: 20, step: 0.5 },
  oddAngleDeg: { min: 0, max: 45, step: 0.5 },
  maxDepth: { min: 8, max: 34, step: 1 },
  levelsPerSecond: { min: 1, max: 12, step: 1 },
} as const

export const DEFAULT_TREE: TreeConfig = {
  evenAngleDeg: 8,
  oddAngleDeg: 20,
  maxDepth: 26,
  levelsPerSecond: 4,
  labelSmall: false,
}

export const TREE_PRESETS: Preset<TreeConfig>[] = [
  {
    label: 'Classic coral',
    note: 'The balanced angles that give the reverse tree its organic reef look.',
    config: { ...DEFAULT_TREE },
  },
  {
    label: 'Windswept',
    note: 'A gentle even bend against a hard odd turn sweeps the whole tree sideways.',
    config: { ...DEFAULT_TREE, evenAngleDeg: 3, oddAngleDeg: 32 },
  },
  {
    label: 'Tight curl',
    note: 'Strong even rotation coils the doubling runs into spirals.',
    config: { ...DEFAULT_TREE, evenAngleDeg: 16, oddAngleDeg: 12, maxDepth: 24 },
  },
]

export interface TreeReadout {
  nodesDrawn: number
  depthDrawn: number
  totalNodes: number
  totalDepth: number
  done: boolean
}

/* ---------- Stopping-time statistics ---------- */

export interface StatsConfig {
  maxN: number
}

export const STATS_STOPS = [
  1_000, 5_000, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
]

export const DEFAULT_STATS: StatsConfig = { maxN: 100_000 }

export interface StatsRecordEntry {
  n: number
  steps: number
}

export interface StatsReadout {
  computed: number
  maxN: number
  maxSteps: number
  maxStepsN: number
  meanSteps: number
  /* Only the newest few records ride along; the count covers them all. */
  records: StatsRecordEntry[]
  recordCount: number
  done: boolean
}

/* ---------- Preset matching ---------- */

/*
 * Deep equality over the flat config shapes above (primitives and one
 * level of number arrays), used to light up the active preset button.
 */
export function sameConfig<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[]
  return keys.every((key) => {
    const va = a[key]
    const vb = b[key]
    if (Array.isArray(va) && Array.isArray(vb)) {
      return va.length === vb.length && va.every((item, i) => item === vb[i])
    }
    return va === vb
  })
}
