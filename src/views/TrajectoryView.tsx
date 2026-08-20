import { useCallback, useState } from 'react'
import type { TrajectoryConfig, TrajectoryReadout } from '../config.ts'
import { formatInt, formatValue } from '../math/format.ts'
import { TrajectoryControls } from '../ui/TrajectoryControls.tsx'
import { Explainer } from '../ui/Explainer.tsx'
import { TrajectoryCanvas } from '../viz/TrajectoryCanvas.tsx'

interface TrajectoryViewProps {
  config: TrajectoryConfig
  onConfigChange: (patch: Partial<TrajectoryConfig>) => void
  onPreset: (config: TrajectoryConfig) => void
}

export function TrajectoryView({ config, onConfigChange, onPreset }: TrajectoryViewProps) {
  const [restartToken, setRestartToken] = useState(0)
  const [finishToken, setFinishToken] = useState(0)
  const [paused, setPaused] = useState(false)
  const [readout, setReadout] = useState<TrajectoryReadout | null>(null)

  const handlePreset = useCallback(
    (preset: TrajectoryConfig) => {
      onPreset(preset)
      setPaused(false)
      setRestartToken((token) => token + 1)
    },
    [onPreset],
  )

  const handleTogglePause = useCallback(() => {
    setPaused((value) => !value)
  }, [])

  const handleRestart = useCallback(() => {
    setPaused(false)
    setRestartToken((token) => token + 1)
  }, [])

  const handleFinish = useCallback(() => {
    setPaused(false)
    setFinishToken((token) => token + 1)
  }, [])

  return (
    <div className="layout">
      <section className="chart-panel" aria-label="Hailstone trajectories">
        <ul className="legend">
          {config.mode === 'list' ? (
            <>
              <li>
                <span className="swatch swatch-odd" aria-hidden="true" />
                odd step, 3n + 1
              </li>
              <li>
                <span className="swatch swatch-even" aria-hidden="true" />
                even step, n / 2
              </li>
            </>
          ) : (
            <>
              <li>
                <span className="swatch swatch-faint" aria-hidden="true" />
                trajectories
              </li>
              <li>
                <span className="swatch swatch-record" aria-hidden="true" />
                longest trajectory
              </li>
            </>
          )}
        </ul>
        <TrajectoryCanvas
          config={config}
          restartToken={restartToken}
          finishToken={finishToken}
          paused={paused}
          onReadout={setReadout}
        />
        <dl className="readouts">
          <div>
            <dt>step</dt>
            <dd>{readout ? formatInt(readout.step) : 0}</dd>
          </div>
          <div>
            <dt>branches</dt>
            <dd>{readout ? formatInt(readout.branches) : 0}</dd>
          </div>
          <div>
            <dt>running</dt>
            <dd>{readout ? formatInt(readout.running) : 0}</dd>
          </div>
          <div>
            <dt>longest home</dt>
            <dd>
              {readout && readout.longestSteps >= 0
                ? `${formatInt(readout.longestN)} in ${formatInt(readout.longestSteps)}`
                : 'n/a'}
            </dd>
          </div>
          <div>
            <dt>peak so far</dt>
            <dd>
              {readout && readout.peakValue >= 0
                ? `${formatValue(readout.peakValue)} by ${formatInt(readout.peakN)}`
                : 'n/a'}
            </dd>
          </div>
          {readout !== null && readout.overflowed > 0 && (
            <div>
              <dt>stopped early</dt>
              <dd>{`${formatInt(readout.overflowed)} past 2^53`}</dd>
            </div>
          )}
        </dl>
      </section>
      <TrajectoryControls
        config={config}
        paused={paused}
        done={readout?.done ?? false}
        onChange={onConfigChange}
        onPreset={handlePreset}
        onTogglePause={handleTogglePause}
        onRestart={handleRestart}
        onFinish={handleFinish}
      />
      <Explainer view="trajectories" />
    </div>
  )
}
