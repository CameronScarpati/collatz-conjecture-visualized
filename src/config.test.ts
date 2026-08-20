import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRAJECTORY,
  MAX_LIST_STARTS,
  MAX_RANGE_N,
  SPEED_STOPS,
  STATS_STOPS,
  TRAJECTORY_PRESETS,
  TREE_BOUNDS,
  TREE_PRESETS,
  sameConfig,
} from './config.ts'
import { parseStarts } from './math/collatz.ts'

describe('trajectory presets', () => {
  it('stay inside every control bound so buttons cannot desync', () => {
    for (const preset of TRAJECTORY_PRESETS) {
      const cfg = preset.config
      expect(SPEED_STOPS).toContain(cfg.stepsPerSecond)
      expect(cfg.rangeN).toBeGreaterThanOrEqual(1)
      expect(cfg.rangeN).toBeLessThanOrEqual(MAX_RANGE_N)
      const parsed = parseStarts(cfg.starts.join(', '), MAX_LIST_STARTS)
      expect(parsed).toEqual({ starts: cfg.starts })
    }
  })

  it('keeps the default on the log axis, where hailstones read best', () => {
    expect(DEFAULT_TRAJECTORY.yMode).toBe('log2')
  })
})

describe('tree presets', () => {
  it('stay inside the slider bounds', () => {
    for (const preset of TREE_PRESETS) {
      const cfg = preset.config
      expect(cfg.evenAngleDeg).toBeGreaterThanOrEqual(TREE_BOUNDS.evenAngleDeg.min)
      expect(cfg.evenAngleDeg).toBeLessThanOrEqual(TREE_BOUNDS.evenAngleDeg.max)
      expect(cfg.oddAngleDeg).toBeGreaterThanOrEqual(TREE_BOUNDS.oddAngleDeg.min)
      expect(cfg.oddAngleDeg).toBeLessThanOrEqual(TREE_BOUNDS.oddAngleDeg.max)
      expect(cfg.maxDepth).toBeGreaterThanOrEqual(TREE_BOUNDS.maxDepth.min)
      expect(cfg.maxDepth).toBeLessThanOrEqual(TREE_BOUNDS.maxDepth.max)
      expect(cfg.levelsPerSecond).toBeGreaterThanOrEqual(TREE_BOUNDS.levelsPerSecond.min)
      expect(cfg.levelsPerSecond).toBeLessThanOrEqual(TREE_BOUNDS.levelsPerSecond.max)
    }
  })
})

describe('stats stops', () => {
  it('ascend and stay within the Uint16 safe range', () => {
    for (let i = 1; i < STATS_STOPS.length; i += 1) {
      expect(STATS_STOPS[i]).toBeGreaterThan(STATS_STOPS[i - 1])
    }
    expect(STATS_STOPS[STATS_STOPS.length - 1]).toBe(1_000_000)
  })
})

describe('sameConfig', () => {
  it('matches identical configs and rejects one-field diffs', () => {
    expect(sameConfig(DEFAULT_TRAJECTORY, { ...DEFAULT_TRAJECTORY })).toBe(true)
    expect(sameConfig(DEFAULT_TRAJECTORY, { ...DEFAULT_TRAJECTORY, rangeN: 2 })).toBe(false)
    expect(
      sameConfig(DEFAULT_TRAJECTORY, { ...DEFAULT_TRAJECTORY, starts: [27, 28] }),
    ).toBe(false)
    expect(
      sameConfig(DEFAULT_TRAJECTORY, { ...DEFAULT_TRAJECTORY, starts: [28] }),
    ).toBe(false)
    expect(
      sameConfig(DEFAULT_TRAJECTORY, { ...DEFAULT_TRAJECTORY, starts: [27] }),
    ).toBe(true)
  })
})
