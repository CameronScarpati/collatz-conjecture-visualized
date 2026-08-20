import { scaleLinear, scaleLog } from 'd3-scale'

export type ValueMode = 'log2' | 'linear'

/*
 * Minimal structural view of a d3 continuous scale so draw code depends on
 * math only, never on d3's DOM-facing helpers.
 */
export interface NumericScale {
  (value: number): number
  domain(): number[]
  ticks(count?: number): number[]
}

export function pow2Ceil(value: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, value)))
}

/* Step index along the x axis; steps start at 0. */
export function makeStepScale(maxSteps: number, range: [number, number]): NumericScale {
  return scaleLinear().domain([0, Math.max(1, maxSteps)]).range(range)
}

/*
 * Hailstone values live on a base-2 log axis by default because the map
 * itself is about doubling and halving: powers of two become straight
 * lines and every trajectory's swings stay readable. Linear mode is kept
 * for the shock value of the raw spikes.
 */
export function makeValueScale(
  mode: ValueMode,
  maxValue: number,
  range: [number, number],
): NumericScale {
  if (mode === 'log2') {
    return scaleLog().base(2).domain([1, pow2Ceil(maxValue)]).range(range).clamp(true)
  }
  return scaleLinear().domain([0, maxValue]).nice(6).range(range).clamp(true)
}

export function makeLinearScale(
  domain: [number, number],
  range: [number, number],
): NumericScale {
  return scaleLinear().domain(domain).range(range)
}

/*
 * Ticks for the log2 axis: powers of two with the exponent step widened
 * until at most about ten labels fit. d3's own log ticks target base 10
 * and turn unreadable in base 2.
 */
export function log2TickValues(maxValue: number): number[] {
  const maxExponent = Math.ceil(Math.log2(Math.max(2, maxValue)))
  const step = Math.max(1, Math.ceil((maxExponent + 1) / 10))
  const values: number[] = []
  for (let e = 0; e <= maxExponent; e += step) values.push(2 ** e)
  if (values[values.length - 1] !== 2 ** maxExponent) values.push(2 ** maxExponent)
  return values
}

/*
 * Vertical headroom for the stopping-time scatter, per N stop. Padded
 * above the true maxima (178, 237, 261, 323, 350, 442, 448, 524) so the
 * record markers never sit on the frame.
 */
const STATS_Y_MAX: Record<number, number> = {
  1_000: 200,
  5_000: 260,
  10_000: 300,
  50_000: 360,
  100_000: 400,
  250_000: 480,
  500_000: 500,
  1_000_000: 560,
}

export function statsYMax(maxN: number): number {
  return STATS_Y_MAX[maxN] ?? 600
}
