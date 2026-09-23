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
        expect(children[1]! % 2).toBe(1)
        expect(3 * children[1]! + 1).toBe(m)
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
      const node = coral.nodes[i]!
      expect(node.depth).toBeGreaterThanOrEqual(coral.nodes[i - 1]!.depth)
      expect(coral.nodes[node.parent]!.depth).toBe(node.depth - 1)
    }
  })

  it('reports level offsets that slice the array by depth', () => {
    const coral = growCoral(config)
    const offsets = coral.levelOffsets
    expect(offsets[0]).toBe(0)
    expect(offsets[offsets.length - 1]).toBe(coral.nodes.length)
    for (let d = 0; d < offsets.length - 1; d += 1) {
      for (let i = offsets[d]!; i < offsets[d + 1]!; i += 1) {
        expect(coral.nodes[i]!.depth).toBe(d)
      }
    }
  })

  it('respects the node budget exactly', () => {
    const coral = growCoral({ ...config, maxDepth: 40, nodeBudget: 500 })
    expect(coral.nodes.length).toBe(500)
  })

  it('turns the budget away between two children of one node', () => {
    /*
     * The first five nodes are 1 2 4 8 16, and 16 has two children, 32
     * and 5. A budget of 6 admits 32 and must refuse 5.
     */
    const coral = growCoral({ ...config, maxDepth: 40, nodeBudget: 6 })
    expect(coral.nodes.map((n) => n.value)).toEqual([1, 2, 4, 8, 16, 32])
  })

  it('places nodes by hand-computed turns and decaying segment lengths', () => {
    /*
     * The root heads straight up. Doubling turns 90 degrees clockwise and
     * the odd branch turns 45 degrees counterclockwise, and the segment
     * into depth k + 1 has length 0.985^k. Down to depth 5 the spine
     * 1 2 4 8 16 32 runs right, down, left, up, right, and 5 leaves 16
     * heading up and to the left, the first odd branch. Nothing is grown
     * past depth 5.
     */
    const coral = growCoral({ evenAngleDeg: 90, oddAngleDeg: 45, maxDepth: 5 })
    const l1 = 0.985
    const l2 = 0.985 ** 2
    const l3 = 0.985 ** 3
    const l4 = 0.985 ** 4
    const x16 = 1 - l2
    const y16 = -l1 + l3
    const expected = [
      { value: 1, x: 0, y: 0, angle: Math.PI / 2, depth: 0, parent: -1 },
      { value: 2, x: 1, y: 0, angle: 0, depth: 1, parent: 0 },
      { value: 4, x: 1, y: -l1, angle: -Math.PI / 2, depth: 2, parent: 1 },
      { value: 8, x: x16, y: -l1, angle: -Math.PI, depth: 3, parent: 2 },
      { value: 16, x: x16, y: y16, angle: -1.5 * Math.PI, depth: 4, parent: 3 },
      { value: 32, x: x16 + l4, y: y16, angle: -2 * Math.PI, depth: 5, parent: 4 },
      {
        value: 5,
        x: x16 - l4 * Math.SQRT1_2,
        y: y16 + l4 * Math.SQRT1_2,
        angle: -1.25 * Math.PI,
        depth: 5,
        parent: 4,
      },
    ]
    expect(coral.nodes).toEqual(
      expected.map((node) => ({
        ...node,
        x: expect.closeTo(node.x, 9),
        y: expect.closeTo(node.y, 9),
        angle: expect.closeTo(node.angle, 9),
      })),
    )
    expect(coral.levelOffsets).toEqual([0, 1, 2, 3, 4, 5, 7])
    expect(coral.bbox).toEqual({
      minX: expect.closeTo(x16 - l4 * Math.SQRT1_2, 9),
      minY: expect.closeTo(-l1, 9),
      maxX: expect.closeTo(1, 9),
      maxY: expect.closeTo(y16 + l4 * Math.SQRT1_2, 9),
    })
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
