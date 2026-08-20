import { useCallback, useState } from 'react'
import type { TreeConfig, TreeReadout } from '../config.ts'
import { formatInt } from '../math/format.ts'
import { TreeControls } from '../ui/TreeControls.tsx'
import { Explainer } from '../ui/Explainer.tsx'
import { TreeCanvas } from '../viz/TreeCanvas.tsx'

interface TreeViewProps {
  config: TreeConfig
  onConfigChange: (patch: Partial<TreeConfig>) => void
  onPreset: (config: TreeConfig) => void
}

export function TreeView({ config, onConfigChange, onPreset }: TreeViewProps) {
  const [restartToken, setRestartToken] = useState(0)
  const [finishToken, setFinishToken] = useState(0)
  const [paused, setPaused] = useState(false)
  const [readout, setReadout] = useState<TreeReadout | null>(null)

  const handlePreset = useCallback(
    (preset: TreeConfig) => {
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
      <section className="chart-panel" aria-label="Reverse Collatz tree">
        <ul className="legend">
          <li>
            <span className="swatch swatch-even" aria-hidden="true" />
            doubling runs, toward the trunk
          </li>
          <li>
            <span className="swatch swatch-odd" aria-hidden="true" />
            odd branches, toward the tips
          </li>
        </ul>
        <TreeCanvas
          config={config}
          restartToken={restartToken}
          finishToken={finishToken}
          paused={paused}
          onReadout={setReadout}
        />
        <dl className="readouts">
          <div>
            <dt>numbers grown</dt>
            <dd>{readout ? formatInt(readout.nodesDrawn) : 0}</dd>
          </div>
          <div>
            <dt>of</dt>
            <dd>{readout ? formatInt(readout.totalNodes) : 0}</dd>
          </div>
          <div>
            <dt>depth</dt>
            <dd>
              {readout
                ? `${formatInt(readout.depthDrawn)} / ${formatInt(readout.totalDepth)}`
                : '0 / 0'}
            </dd>
          </div>
        </dl>
      </section>
      <TreeControls
        config={config}
        paused={paused}
        done={readout?.done ?? false}
        onChange={onConfigChange}
        onPreset={handlePreset}
        onTogglePause={handleTogglePause}
        onRestart={handleRestart}
        onFinish={handleFinish}
      />
      <Explainer view="tree" />
    </div>
  )
}
