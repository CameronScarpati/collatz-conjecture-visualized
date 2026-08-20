import { describe, expect, it } from 'vitest'
import { childrenOf, growCoral } from './tree.ts'

describe('childrenOf', () => {
  it('always doubles, and only branches on 4 mod 6', () => {
    expect(childrenOf(1)).toEqual([2])
    expect(childrenOf(2)).toEqual([4])
    expect(childrenOf(16)).toEqual([32, 5])
    expect(childrenOf(10)).toEqual([20, 3])
    expect(childrenOf(28)).toEqual([56, 9])
    expect(childrenOf(8)).toEqual([16])
  })

  it('excludes the 4 -> 1 back edge that would close the trivial cycle', () => {
    expect(childrenOf(4)).toEqual([8])
  })

  it('never branches from an odd node', () => {
    expect(childrenOf(7)).toEqual([14])
    expect(childrenOf(5)).toEqual([10])
    for (let m = 1; m < 200; m += 2) {
      expect(childrenOf(m)).toEqual([2 * m])
    }
  })

  it('emits an odd second child whenever it branches', () => {
    for (let m = 4; m < 2_000; m += 6) {
      const children = childrenOf(m)
      if (children.length === 2) {
        expect(children[1] % 2).toBe(1)
        expect(3 * children[1] + 1).toBe(m)
      }
    }
  })
})

describe('growCoral', () => {
  const config = { evenAngleDeg: 8, oddAngleDeg: 20, maxDepth: 14 }

  it('is deterministic', () => {
    expect(growCoral(config)).toEqual(growCoral(config))
  })

  it('roots the tree at 1 and keeps depths contiguous', () => {
    const coral = growCoral(config)
    expect(coral.nodes[0]).toMatchObject({ value: 1, depth: 0, parent: -1 })
    for (let i = 1; i < coral.nodes.length; i += 1) {
      const node = coral.nodes[i]
      expect(node.depth).toBeGreaterThanOrEqual(coral.nodes[i - 1].depth)
      expect(coral.nodes[node.parent].depth).toBe(node.depth - 1)
    }
  })

  it('reports level offsets that slice the array by depth', () => {
    const coral = growCoral(config)
    const offsets = coral.levelOffsets
    expect(offsets[0]).toBe(0)
    expect(offsets[offsets.length - 1]).toBe(coral.nodes.length)
    for (let d = 0; d < offsets.length - 1; d += 1) {
      for (let i = offsets[d]; i < offsets[d + 1]; i += 1) {
        expect(coral.nodes[i].depth).toBe(d)
      }
    }
  })

  it('respects the node budget exactly', () => {
    const coral = growCoral({ ...config, maxDepth: 40, nodeBudget: 500 })
    expect(coral.nodes.length).toBe(500)
  })

  it('bounds every node inside the reported bbox', () => {
    const coral = growCoral(config)
    for (const node of coral.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(coral.bbox.minX)
      expect(node.x).toBeLessThanOrEqual(coral.bbox.maxX)
      expect(node.y).toBeGreaterThanOrEqual(coral.bbox.minY)
      expect(node.y).toBeLessThanOrEqual(coral.bbox.maxY)
    }
  })

  it('contains the values a depth-14 reverse tree must contain', () => {
    const coral = growCoral(config)
    const values = new Set(coral.nodes.map((n) => n.value))
    /* The spine of doublings plus the first few odd branches. */
    for (const expected of [1, 2, 4, 8, 16, 5, 32, 10, 3, 64, 20, 21, 6]) {
      expect(values.has(expected)).toBe(true)
    }
  })
})
