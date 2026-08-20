import { motion, useReducedMotion } from 'motion/react'
import {
  TREE_BOUNDS,
  TREE_PRESETS,
  sameConfig,
  type TreeConfig,
} from '../config.ts'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

const railVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
}

interface TreeControlsProps {
  config: TreeConfig
  paused: boolean
  done: boolean
  onChange: (patch: Partial<TreeConfig>) => void
  onPreset: (config: TreeConfig) => void
  onTogglePause: () => void
  onRestart: () => void
  onFinish: () => void
}

export function TreeControls({
  config,
  paused,
  done,
  onChange,
  onPreset,
  onTogglePause,
  onRestart,
  onFinish,
}: TreeControlsProps) {
  const reduced = useReducedMotion() === true

  return (
    <motion.form
      className="controls"
      onSubmit={(event) => event.preventDefault()}
      variants={railVariants}
      initial={reduced ? false : 'hidden'}
      animate="show"
    >
      <motion.fieldset className="segmented-group" variants={itemVariants}>
        <legend>Shapes</legend>
        <div className="preset-row">
          {TREE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={
                sameConfig(config, preset.config) ? 'preset preset-active' : 'preset'
              }
              title={preset.note}
              onClick={() => onPreset(preset.config)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </motion.fieldset>

      <motion.label className="control" variants={itemVariants}>
        <span className="control-line">
          Doubling bend
          <output>{config.evenAngleDeg.toFixed(1)}&deg;</output>
        </span>
        <input
          type="range"
          min={TREE_BOUNDS.evenAngleDeg.min}
          max={TREE_BOUNDS.evenAngleDeg.max}
          step={TREE_BOUNDS.evenAngleDeg.step}
          value={config.evenAngleDeg}
          onChange={(event) => onChange({ evenAngleDeg: Number(event.target.value) })}
        />
      </motion.label>

      <motion.label className="control" variants={itemVariants}>
        <span className="control-line">
          Odd branch bend
          <output>{config.oddAngleDeg.toFixed(1)}&deg;</output>
        </span>
        <input
          type="range"
          min={TREE_BOUNDS.oddAngleDeg.min}
          max={TREE_BOUNDS.oddAngleDeg.max}
          step={TREE_BOUNDS.oddAngleDeg.step}
          value={config.oddAngleDeg}
          onChange={(event) => onChange({ oddAngleDeg: Number(event.target.value) })}
        />
      </motion.label>

      <motion.label className="control" variants={itemVariants}>
        <span className="control-line">
          Depth
          <output>{config.maxDepth} levels</output>
        </span>
        <input
          type="range"
          min={TREE_BOUNDS.maxDepth.min}
          max={TREE_BOUNDS.maxDepth.max}
          step={TREE_BOUNDS.maxDepth.step}
          value={config.maxDepth}
          onChange={(event) => onChange({ maxDepth: Number(event.target.value) })}
        />
      </motion.label>

      <motion.label className="control" variants={itemVariants}>
        <span className="control-line">
          Growth speed
          <output>{config.levelsPerSecond} levels/s</output>
        </span>
        <input
          type="range"
          min={TREE_BOUNDS.levelsPerSecond.min}
          max={TREE_BOUNDS.levelsPerSecond.max}
          step={TREE_BOUNDS.levelsPerSecond.step}
          value={config.levelsPerSecond}
          onChange={(event) => onChange({ levelsPerSecond: Number(event.target.value) })}
        />
      </motion.label>

      <motion.label className="check-field" variants={itemVariants}>
        <input
          type="checkbox"
          checked={config.labelSmall}
          onChange={(event) => onChange({ labelSmall: event.target.checked })}
        />
        Label numbers below 100
      </motion.label>

      <motion.div className="control-row" variants={itemVariants}>
        <button type="button" onClick={onTogglePause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={onRestart}>
          Regrow
        </button>
        <button type="button" onClick={onFinish} disabled={done}>
          Finish
        </button>
      </motion.div>
    </motion.form>
  )
}
