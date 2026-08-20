/*
 * The reverse Collatz tree, grown from 1, with the organic layout made
 * famous by Edmund Harriss: every edge bends a little by the parity of
 * the branch it takes, so doubling runs curl one way and the rarer odd
 * predecessors curl the other, and the tree comes out looking like coral.
 *
 * The layout is pure and deterministic: given a config it always returns
 * the same node positions, so it runs once per config change and the
 * canvas only projects and strokes.
 */

export const NODE_BUDGET = 25_000

/* Segment length decays gently with depth so outer growth stays fine. */
const LENGTH_DECAY = 0.985

export interface CoralConfig {
  evenAngleDeg: number
  oddAngleDeg: number
  maxDepth: number
  nodeBudget?: number
}

export interface CoralNode {
  value: number
  x: number
  y: number
  /* Direction of travel into this node, radians. */
  angle: number
  depth: number
  /* Index of the parent in the nodes array, -1 for the root. */
  parent: number
}

export interface Coral {
  /* BFS order, so each depth level is a contiguous slice. */
  nodes: CoralNode[]
  /* Index of the first node at each depth, ending with nodes.length. */
  levelOffsets: number[]
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
}

/*
 * Predecessors of m under the Collatz map: 2m always, and (m - 1) / 3
 * exactly when m is 4 mod 6 (which forces the quotient odd) and m is not
 * 4 itself. Excluding 4 -> 1 drops the map's only cycle, so the reverse
 * graph is a genuine tree rooted at 1.
 */
export function childrenOf(m: number): number[] {
  const children = [2 * m]
  if (m % 6 === 4 && m > 4) children.push((m - 1) / 3)
  return children
}

export function growCoral(config: CoralConfig): Coral {
  const budget = config.nodeBudget ?? NODE_BUDGET
  const evenAngle = (config.evenAngleDeg * Math.PI) / 180
  const oddAngle = (config.oddAngleDeg * Math.PI) / 180

  const nodes: CoralNode[] = [
    { value: 1, x: 0, y: 0, angle: Math.PI / 2, depth: 0, parent: -1 },
  ]
  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0

  /* nodes doubles as the BFS queue; head chases the growing tail. */
  let head = 0
  while (head < nodes.length && nodes.length < budget) {
    const node = nodes[head]
    if (node.depth >= config.maxDepth) break

    const length = Math.pow(LENGTH_DECAY, node.depth)
    for (const value of childrenOf(node.value)) {
      if (nodes.length >= budget) break
      /* Doubling bends clockwise, the odd predecessor counterclockwise. */
      const angle =
        value === 2 * node.value ? node.angle - evenAngle : node.angle + oddAngle
      const x = node.x + length * Math.cos(angle)
      const y = node.y + length * Math.sin(angle)
      nodes.push({ value, x, y, angle, depth: node.depth + 1, parent: head })
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    head += 1
  }

  /* BFS order makes each depth contiguous, so offsets read straight off. */
  const offsets: number[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i].depth === offsets.length) offsets.push(i)
  }
  offsets.push(nodes.length)

  return { nodes, levelOffsets: offsets, bbox: { minX, minY, maxX, maxY } }
}
