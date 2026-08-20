import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  MAX_LIST_STARTS,
  MAX_RANGE_N,
  SPEED_STOPS,
  TRAJECTORY_PRESETS,
  sameConfig,
  type TrajectoryConfig,
} from '../config.ts'
import { parseStarts } from '../math/collatz.ts'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

const railVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
}

interface StartsFieldProps {
  starts: number[]
  onCommit: (starts: number[]) => void
}

/*
 * Uncommitted text lives here; the parent remounts the field via key
 * whenever the committed starts change, so presets and external edits
 * reset it without any state synchronization.
 */
function StartsField({ starts, onCommit }: StartsFieldProps) {
  const [text, setText] = useState(() => starts.join(', '))
  const [error, setError] = useState<string | null>(null)

  const commit = () => {
    const parsed = parseStarts(text, MAX_LIST_STARTS)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setError(null)
    onCommit(parsed.starts)
  }

  return (
    <>
      <label className="text-field">
        <span>Starts, up to {MAX_LIST_STARTS}, separated by commas</span>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
          }}
        />
      </label>
      {error && (
        <p className="field-error" role="status">
          {error}
        </p>
      )}
    </>
  )
}

interface TrajectoryControlsProps {
  config: TrajectoryConfig
  paused: boolean
  done: boolean
  onChange: (patch: Partial<TrajectoryConfig>) => void
  onPreset: (config: TrajectoryConfig) => void
  onTogglePause: () => void
  onRestart: () => void
  onFinish: () => void
}

export function TrajectoryControls({
  config,
  paused,
  done,
  onChange,
  onPreset,
  onTogglePause,
  onRestart,
  onFinish,
}: TrajectoryControlsProps) {
  const reduced = useReducedMotion() === true
  const speedIndex = SPEED_STOPS.indexOf(config.stepsPerSecond)

  return (
    <motion.form
      className="controls"
      onSubmit={(event) => event.preventDefault()}
      variants={railVariants}
      initial={reduced ? false : 'hidden'}
      animate="show"
    >
      <motion.fieldset className="segmented-group" variants={itemVariants}>
        <legend>Story presets</legend>
        <div className="preset-row">
          {TRAJECTORY_PRESETS.map((preset) => (
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

      <motion.fieldset className="segmented-group" variants={itemVariants}>
        <legend>Starting numbers</legend>
        <div className="segmented">
          <label>
            <input
              type="radio"
              name="trajectory-mode"
              checked={config.mode === 'list'}
              onChange={() => onChange({ mode: 'list' })}
            />
            <span>Chosen starts</span>
          </label>
          <label>
            <input
              type="radio"
              name="trajectory-mode"
              checked={config.mode === 'range'}
              onChange={() => onChange({ mode: 'range' })}
            />
            <span>Every start up to N</span>
          </label>
        </div>
      </motion.fieldset>

      {config.mode === 'list' ? (
        <motion.div className="control" variants={itemVariants}>
          <StartsField
            key={config.starts.join(',')}
            starts={config.starts}
            onCommit={(starts) => onChange({ starts })}
          />
        </motion.div>
      ) : (
        <motion.label className="control" variants={itemVariants}>
          <span className="control-line">
            N
            <output>{config.rangeN.toLocaleString('en-US')}</output>
          </span>
          <input
            type="range"
            min={10}
            max={MAX_RANGE_N}
            step={10}
            value={config.rangeN}
            onChange={(event) => onChange({ rangeN: Number(event.target.value) })}
          />
        </motion.label>
      )}

      <motion.fieldset className="segmented-group" variants={itemVariants}>
        <legend>Vertical axis</legend>
        <div className="segmented">
          <label>
            <input
              type="radio"
              name="trajectory-ymode"
              checked={config.yMode === 'log2'}
              onChange={() => onChange({ yMode: 'log2' })}
            />
            <span>Log base 2</span>
          </label>
          <label>
            <input
              type="radio"
              name="trajectory-ymode"
              checked={config.yMode === 'linear'}
              onChange={() => onChange({ yMode: 'linear' })}
            />
            <span>Linear</span>
          </label>
        </div>
      </motion.fieldset>

      <motion.label className="control" variants={itemVariants}>
        <span className="control-line">
          Speed
          <output>{config.stepsPerSecond} steps/s</output>
        </span>
        <input
          type="range"
          min={0}
          max={SPEED_STOPS.length - 1}
          step={1}
          value={speedIndex === -1 ? 2 : speedIndex}
          onChange={(event) =>
            onChange({ stepsPerSecond: SPEED_STOPS[Number(event.target.value)] })
          }
        />
      </motion.label>

      <motion.div className="control-row" variants={itemVariants}>
        <button type="button" onClick={onTogglePause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={onRestart}>
          Restart
        </button>
        <button type="button" onClick={onFinish} disabled={done}>
          Finish
        </button>
      </motion.div>
    </motion.form>
  )
}
