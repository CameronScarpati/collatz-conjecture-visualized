import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { STATS_STOPS, type StatsConfig } from '../config.ts'
import { formatInt } from '../math/format.ts'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

const railVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
}

interface StatsControlsProps {
  config: StatsConfig
  onChange: (patch: Partial<StatsConfig>) => void
}

export function StatsControls({ config, onChange }: StatsControlsProps) {
  const [stopIndex, setStopIndex] = useState(() =>
    Math.max(0, STATS_STOPS.indexOf(config.maxN)),
  )
  const onChangeRef = useRef(onChange)
  const reduced = useReducedMotion() === true

  useEffect(() => {
    onChangeRef.current = onChange
  })

  /* Debounced commit: dragging across stops restarts the computation only
     once the slider settles for a moment. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      onChangeRef.current({ maxN: STATS_STOPS[stopIndex] })
    }, 250)
    return () => window.clearTimeout(id)
  }, [stopIndex])

  return (
    <motion.form
      className="controls"
      onSubmit={(event) => event.preventDefault()}
      variants={railVariants}
      initial={reduced ? false : 'hidden'}
      animate="show"
    >
      <motion.label className="control" variants={itemVariants}>
        <span className="control-line">
          Starts to compute
          <output>{formatInt(STATS_STOPS[stopIndex])}</output>
        </span>
        <input
          type="range"
          min={0}
          max={STATS_STOPS.length - 1}
          step={1}
          value={stopIndex}
          onChange={(event) => setStopIndex(Number(event.target.value))}
        />
      </motion.label>
      <motion.p className="field-note" variants={itemVariants}>
        Every stopping time up to one million computes in about a second, spread
        across animation frames so the page never stalls. Records ring themselves
        as the sweep passes them.
      </motion.p>
    </motion.form>
  )
}
