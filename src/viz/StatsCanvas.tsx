import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import type { StatsConfig, StatsReadout } from '../config.ts'
import { formatInt, formatTickLinear } from '../math/format.ts'
import {
  advanceStoppingRun,
  buildHistogram,
  createStoppingRun,
  type StoppingRun,
} from '../math/stoppingTimes.ts'
import { readToken } from '../theme/theme.ts'
import {
  DEFAULT_MARGIN,
  clearCanvas,
  drawAxes,
  drawBars,
  drawGrid,
  drawRecordMarkers,
  plotArea,
  sizeCanvas,
  type ChartLayout,
} from './draw.ts'
import { makeLinearScale, statsYMax, type NumericScale } from './scales.ts'
import { useAnimationLoop } from './useAnimationLoop.ts'

interface SimState {
  run: StoppingRun
  /* Last start whose dot is already on the scatter canvas. */
  plotted: number
  finishedDrawn: boolean
}

interface ViewState {
  layout: ChartLayout
  x: NumericScale
  y: NumericScale
  bg: CanvasRenderingContext2D
  fg: CanvasRenderingContext2D
  hist: {
    layout: ChartLayout
    ctx: CanvasRenderingContext2D
  } | null
  palette: {
    grid: string
    label: string
    odd: string
    even: string
    record: string
    surface: string
    monoFont: string
  }
}

const FRAME_BUDGET_MS = 8
const ADVANCE_QUOTA = 2_000
const HIST_MARGIN = { top: 8, right: 20, bottom: 26, left: 58 }

interface StatsCanvasProps {
  config: StatsConfig
  onReadout?: (readout: StatsReadout) => void
}

export function StatsCanvas({ config, onReadout }: StatsCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLCanvasElement>(null)
  const fgRef = useRef<HTMLCanvasElement>(null)
  const histWrapperRef = useRef<HTMLDivElement>(null)
  const histRef = useRef<HTMLCanvasElement>(null)

  const configRef = useRef(config)
  const onReadoutRef = useRef(onReadout)
  const simRef = useRef<SimState | null>(null)
  const viewRef = useRef<ViewState | null>(null)

  const reduced = useReducedMotion() === true

  useEffect(() => {
    configRef.current = config
    onReadoutRef.current = onReadout
  })

  const helpersRef = useRef<{
    resetSim: () => void
    rebuildView: () => void
    finishNow: () => void
    emitReadout: () => void
    frame: (dt: number) => void
  } | null>(null)

  if (helpersRef.current === null) {
    const drawStatic = () => {
      const view = viewRef.current
      if (!view) return
      clearCanvas(view.bg, view.layout)
      const yTicks = view.y.ticks(6)
      drawGrid(view.bg, view.layout, view.y, yTicks, view.palette.grid)
      drawAxes(
        view.bg,
        view.layout,
        view.x,
        view.y,
        yTicks,
        { grid: view.palette.grid, label: view.palette.label },
        view.palette.monoFont,
        { x: formatTickLinear, y: formatTickLinear },
      )
    }

    /*
     * Dots accumulate at low alpha, so overlapping starts read as density
     * shading without a single expensive clear-and-redraw pass.
     */
    const plotPoints = (from: number, to: number) => {
      const view = viewRef.current
      const sim = simRef.current
      if (!view || !sim || to < from) return
      const ctx = view.fg
      ctx.save()
      ctx.globalAlpha = 0.35
      ctx.fillStyle = view.palette.odd
      for (let n = from; n <= to; n += 1) {
        const x = view.x(n)
        const y = view.y(sim.run.steps[n])
        ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5)
      }
      ctx.restore()
    }

    const drawFinished = () => {
      const view = viewRef.current
      const sim = simRef.current
      if (!view || !sim) return
      drawRecordMarkers(
        view.fg,
        view.layout,
        sim.run.records.map((record) => ({
          x: view.x(record.n),
          y: view.y(record.steps),
          label: `${formatInt(record.n)} in ${formatInt(record.steps)}`,
        })),
        {
          color: view.palette.record,
          casing: view.palette.surface,
          font: view.palette.monoFont,
        },
      )
      if (view.hist) {
        const histogram = buildHistogram(sim.run)
        const area = plotArea(view.hist.layout)
        const xMax = histogram.bins.length * histogram.binWidth
        const x = makeLinearScale([0, xMax], [area.x, area.x + area.w])
        const y = makeLinearScale([0, Math.max(1, histogram.maxCount)], [
          area.y + area.h,
          area.y,
        ])
        clearCanvas(view.hist.ctx, view.hist.layout)
        drawAxes(
          view.hist.ctx,
          view.hist.layout,
          x,
          y,
          y.ticks(3),
          { grid: view.palette.grid, label: view.palette.label },
          view.palette.monoFont,
          { x: formatTickLinear, y: formatTickLinear },
        )
        drawBars(view.hist.ctx, view.hist.layout, x, y, histogram.bins, histogram.binWidth, view.palette.even)
      }
      sim.finishedDrawn = true
    }

    const resetSim = () => {
      simRef.current = {
        run: createStoppingRun(configRef.current.maxN),
        plotted: 0,
        finishedDrawn: false,
      }
    }

    const rebuildView = () => {
      const wrapper = wrapperRef.current
      const bg = bgRef.current
      const fg = fgRef.current
      const sim = simRef.current
      if (!wrapper || !bg || !fg || !sim) return
      const cfg = configRef.current
      const rect = wrapper.getBoundingClientRect()
      const width = Math.max(rect.width, 200)
      const height = Math.max(rect.height, 160)
      const bgCtx = sizeCanvas(bg, width, height)
      const fgCtx = sizeCanvas(fg, width, height)
      if (!bgCtx || !fgCtx) return
      const layout: ChartLayout = { width, height, margin: DEFAULT_MARGIN }
      const area = plotArea(layout)
      const mono = readToken('--font-mono') || 'monospace'

      let hist: ViewState['hist'] = null
      const histWrapper = histWrapperRef.current
      const histCanvas = histRef.current
      if (histWrapper && histCanvas) {
        const histRect = histWrapper.getBoundingClientRect()
        const histLayout: ChartLayout = {
          width: Math.max(histRect.width, 200),
          height: Math.max(histRect.height, 100),
          margin: HIST_MARGIN,
        }
        const histCtx = sizeCanvas(histCanvas, histLayout.width, histLayout.height)
        if (histCtx) hist = { layout: histLayout, ctx: histCtx }
      }

      viewRef.current = {
        layout,
        x: makeLinearScale([1, cfg.maxN], [area.x, area.x + area.w]),
        y: makeLinearScale([0, statsYMax(cfg.maxN)], [area.y + area.h, area.y]),
        bg: bgCtx,
        fg: fgCtx,
        hist,
        palette: {
          grid: readToken('--line'),
          label: readToken('--text-muted'),
          odd: readToken('--odd'),
          even: readToken('--even'),
          record: readToken('--record'),
          surface: readToken('--surface'),
          monoFont: `500 11px ${mono}`,
        },
      }
      drawStatic()
      clearCanvas(fgCtx, layout)
      plotPoints(1, sim.plotted)
      if (sim.run.done) drawFinished()
    }

    const finishNow = () => {
      const sim = simRef.current
      if (!sim) return
      while (!sim.run.done) advanceStoppingRun(sim.run, sim.run.N)
      plotPoints(sim.plotted + 1, sim.run.N)
      sim.plotted = sim.run.N
      drawFinished()
    }

    const emitReadout = () => {
      const sim = simRef.current
      const emit = onReadoutRef.current
      if (!sim || !emit) return
      const computed = Math.min(sim.run.next - 1, sim.run.N)
      emit({
        computed,
        maxN: sim.run.N,
        maxSteps: sim.run.maxSteps,
        maxStepsN: sim.run.maxStepsN,
        meanSteps: computed > 0 ? sim.run.sumSteps / computed : 0,
        records: sim.run.records.slice(-3),
        recordCount: sim.run.records.length,
        done: sim.run.done,
      })
    }

    const frame = () => {
      const sim = simRef.current
      if (!sim) return
      if (!sim.run.done) {
        const deadline = performance.now() + FRAME_BUDGET_MS
        while (!sim.run.done && performance.now() < deadline) {
          advanceStoppingRun(sim.run, ADVANCE_QUOTA)
        }
        const through = Math.min(sim.run.next - 1, sim.run.N)
        plotPoints(sim.plotted + 1, through)
        sim.plotted = through
      } else if (!sim.finishedDrawn) {
        drawFinished()
        emitReadout()
      }
    }

    helpersRef.current = { resetSim, rebuildView, finishNow, emitReadout, frame }
  }

  const helpers = helpersRef.current

  useEffect(() => {
    helpers.resetSim()
    helpers.rebuildView()
    if (reduced) helpers.finishNow()
    helpers.emitReadout()
  }, [config.maxN, reduced, helpers])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const redraw = () => helpers.rebuildView()
    const resizeObserver = new ResizeObserver(redraw)
    resizeObserver.observe(wrapper)
    const themeObserver = new MutationObserver(redraw)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
    }
  }, [helpers])

  useEffect(() => {
    const id = window.setInterval(helpers.emitReadout, 250)
    return () => window.clearInterval(id)
  }, [helpers])

  useAnimationLoop(helpers.frame, !reduced)

  return (
    <>
      <div
        ref={wrapperRef}
        className="chart-canvas chart-canvas-stats"
        role="img"
        aria-label={`Scatter of total stopping times for every start up to ${formatInt(config.maxN)}, with record setters ringed and labeled`}
      >
        <canvas ref={bgRef} aria-hidden="true" />
        <canvas ref={fgRef} aria-hidden="true" />
      </div>
      <div
        ref={histWrapperRef}
        className="chart-canvas chart-canvas-histogram"
        role="img"
        aria-label="Histogram of the same stopping times, showing most starts finish quickly"
      >
        <canvas ref={histRef} aria-hidden="true" />
      </div>
    </>
  )
}
