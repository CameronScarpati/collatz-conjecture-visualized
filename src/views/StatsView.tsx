import { useState } from 'react'
import type { StatsConfig, StatsReadout } from '../config.ts'
import { formatInt } from '../math/format.ts'
import { StatsControls } from '../ui/StatsControls.tsx'
import { Explainer } from '../ui/Explainer.tsx'
import { StatsCanvas } from '../viz/StatsCanvas.tsx'

interface StatsViewProps {
  config: StatsConfig
  onConfigChange: (patch: Partial<StatsConfig>) => void
}

export function StatsView({ config, onConfigChange }: StatsViewProps) {
  const [readout, setReadout] = useState<StatsReadout | null>(null)

  return (
    <div className="layout">
      <section className="chart-panel" aria-label="Stopping time statistics">
        <ul className="legend">
          <li>
            <span className="swatch swatch-faint" aria-hidden="true" />
            one dot per start
          </li>
          <li>
            <span className="swatch swatch-record" aria-hidden="true" />
            record setters
          </li>
          <li>
            <span className="swatch swatch-even" aria-hidden="true" />
            histogram of stopping times
          </li>
        </ul>
        <StatsCanvas config={config} onReadout={setReadout} />
        <dl className="readouts">
          <div>
            <dt>computed</dt>
            <dd>
              {readout
                ? `${formatInt(readout.computed)} / ${formatInt(readout.maxN)}`
                : '0 / 0'}
            </dd>
          </div>
          <div>
            <dt>record</dt>
            <dd>
              {readout && readout.computed > 0
                ? `${formatInt(readout.maxStepsN)} in ${formatInt(readout.maxSteps)}`
                : 'n/a'}
            </dd>
          </div>
          <div>
            <dt>mean steps</dt>
            <dd>{readout && readout.computed > 0 ? readout.meanSteps.toFixed(1) : 'n/a'}</dd>
          </div>
          <div>
            <dt>records set</dt>
            <dd>{readout ? formatInt(readout.recordCount) : 0}</dd>
          </div>
        </dl>
      </section>
      <StatsControls config={config} onChange={onConfigChange} />
      <Explainer view="stats" />
    </div>
  )
}
