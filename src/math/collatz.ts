/*
 * The Collatz map and forward trajectories, in plain numbers.
 *
 * Plain doubles are exact for every integer up to 2^53 - 1, and the input
 * cap plus a per-step guard keep every intermediate inside that range, so
 * BigInt would only slow the hot loops down without changing a single
 * result this app can display.
 */

/*
 * Largest odd n for which 3n + 1 still fits in the exact integer range of
 * a double: floor((2^53 - 2) / 3). Trajectories that would step past this
 * stop and report it instead of silently losing precision.
 */
export const OVERFLOW_LIMIT = 3_002_399_751_580_330

/* Friendly documented cap for user input: one quadrillion. */
export const MAX_START = 1_000_000_000_000_000

export interface Trajectory {
  /* The full hailstone sequence, starting value first, trimmed to length. */
  values: Float64Array
  /* Number of applications of the map, values.length - 1 when complete. */
  steps: number
  peak: number
  /* True when the sequence hit OVERFLOW_LIMIT before reaching 1. */
  overflowed: boolean
}

export function isValidStart(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_START
}

/* One application of the map. Assumes n is a valid positive safe integer. */
export function stepOnce(n: number): number {
  return n % 2 === 0 ? n / 2 : 3 * n + 1
}

export function trajectory(start: number): Trajectory {
  if (!isValidStart(start)) {
    throw new RangeError(`start must be an integer between 1 and ${MAX_START}`)
  }

  let buffer = new Float64Array(256)
  let length = 0
  let peak = start
  let overflowed = false
  let current = start

  for (;;) {
    if (length === buffer.length) {
      const grown = new Float64Array(buffer.length * 2)
      grown.set(buffer)
      buffer = grown
    }
    buffer[length] = current
    length += 1
    if (current > peak) peak = current
    if (current === 1) break
    if (current % 2 === 1 && current > OVERFLOW_LIMIT) {
      overflowed = true
      break
    }
    current = stepOnce(current)
  }

  return {
    values: buffer.slice(0, length),
    steps: length - 1,
    peak,
    overflowed,
  }
}

export type ParsedStarts = { starts: number[] } | { error: string }

/*
 * Parses the free-text starting-numbers field: comma or whitespace
 * separated positive integers, de-duplicated in input order. Returns a
 * message rather than throwing so the field can show it inline.
 */
export function parseStarts(text: string, limit: number): ParsedStarts {
  const tokens = text.split(/[\s,]+/).filter((t) => t.length > 0)
  if (tokens.length === 0) {
    return { error: 'Enter at least one starting number.' }
  }
  const starts: number[] = []
  for (const token of tokens) {
    const value = Number(token)
    if (!isValidStart(value)) {
      return { error: `"${token}" is not a whole number between 1 and 10^15.` }
    }
    if (!starts.includes(value)) starts.push(value)
  }
  if (starts.length > limit) {
    return { error: `At most ${limit} starting numbers at a time.` }
  }
  return { starts }
}
