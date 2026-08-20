import { motion, useReducedMotion } from 'motion/react'
import type { ViewId } from '../config.ts'
import { MathBlock, MathInline } from './Math.tsx'

function TrajectoriesExplainer() {
  return (
    <>
      <h2>What you are seeing</h2>
      <p>
        Pick a whole number and apply one rule over and over: halve it if it is even,
        triple it and add one if it is odd. The chart traces the resulting sequence,
        called a hailstone trajectory, one step at a time. Green segments are the odd
        steps that climb, violet segments are the even steps that fall.
      </p>
      <MathBlock tex="C(n) = \begin{cases} n/2 & n \text{ even} \\ 3n + 1 & n \text{ odd} \end{cases}" />
      <p>
        The Collatz conjecture says that every starting number eventually reaches 1. It
        has been checked far beyond anything this page can plot, yet nobody has proved
        it, and that gap between overwhelming evidence and no proof is the whole
        fascination.
      </p>
      <h2>Why the log axis</h2>
      <p>
        The rule is all doubling and halving, so the vertical axis defaults to powers of
        two. On that axis every halving is the same small drop, a power of two falls in
        a straight line, and a trajectory that spikes four orders of magnitude, as 27
        does on its way to 9,232, still fits on screen with its shape intact.
      </p>
    </>
  )
}

function TreeExplainer() {
  return (
    <>
      <h2>What you are seeing</h2>
      <p>
        This is the same rule run backwards. Starting from 1, the tree asks which
        numbers would have stepped here: every m is reached by 2m, and some m are also
        reached by an odd predecessor.
      </p>
      <MathBlock tex="R(m) = \{\, 2m \,\} \;\cup\; \left\{ \tfrac{m-1}{3} \;:\; m \equiv 4 \;(\mathrm{mod}\ 6),\; m > 4 \right\}" />
      <p>
        The side condition is exact: <MathInline tex="(m-1)/3" /> is a whole odd number
        precisely when m leaves remainder 4 on division by 6. The single predecessor
        edge from 4 back to 1 is dropped, since keeping it would close the loop 1, 4,
        2, 1 and the picture would no longer be a tree.
      </p>
      <h2>Why it looks like coral</h2>
      <p>
        Every edge inherits its direction from its parent and bends by a fixed angle,
        one way for a doubling, the other way for an odd predecessor. Long doubling
        runs curl steadily in one direction while the rarer odd branches kick the other
        way, and out of two bare rules grows something organic. The idea comes from the
        mathematician Edmund Harriss. If the conjecture is true, every whole number
        lives somewhere on this one tree.
      </p>
    </>
  )
}

function StatsExplainer() {
  return (
    <>
      <h2>What you are seeing</h2>
      <p>
        Each dot is one starting number, placed by how many steps it takes to reach 1.
        This count is the total stopping time.
      </p>
      <MathBlock tex="\sigma_{\infty}(n) = \min \{\, k \;:\; C^{k}(n) = 1 \,\}" />
      <p>
        The cloud has structure: dense bands where whole families of starts share a
        fate, and rare outliers that grind on for hundreds of steps. The ringed points
        are record setters, starts that take longer than every start before them, and
        they get sparse quickly. Below one million the record is only 524 steps.
      </p>
      <h2>Why trajectories usually fall</h2>
      <p>
        Here is the standard heuristic. An odd step roughly multiplies the value by 3/2
        once you count the halving that always follows, and an even step multiplies it
        by exactly 1/2. If the two arrive about equally often, a typical step scales
        the value by the geometric mean.
      </p>
      <MathBlock tex="\sqrt{\tfrac{3}{2} \cdot \tfrac{1}{2}} = \tfrac{\sqrt{3}}{2} \approx 0.866 < 1" />
      <p>
        So typical trajectories drift downward, which matches the histogram piling up
        at modest stopping times. This argument proves nothing, because nothing forces
        any single trajectory to behave typically. That is why the conjecture is still
        open.
      </p>
    </>
  )
}

interface ExplainerProps {
  view: ViewId
}

export function Explainer({ view }: ExplainerProps) {
  const reduced = useReducedMotion() === true
  return (
    <motion.section
      key={view}
      className="explainer"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {view === 'trajectories' && <TrajectoriesExplainer />}
      {view === 'tree' && <TreeExplainer />}
      {view === 'stats' && <StatsExplainer />}
    </motion.section>
  )
}
