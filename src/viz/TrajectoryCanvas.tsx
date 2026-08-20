import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import type { TrajectoryConfig, TrajectoryReadout } from '../config.ts'
import { trajectory, type Trajectory } from '../math/collatz.ts'
import { formatPow2, formatTickLinear } from '../math/format.ts'
import { readToken } from '../theme/theme.ts'
import {
  DEFAULT_MARGIN,
  clearCanvas,
  drawAxes,
  drawGrid,
  drawHead,
  drawParitySegments,
  drawPolylineRange,
  sizeCanvas,
  type ChartLayout,
} from './draw.ts'
import {
  log2TickValues,
  makeStepScale,
  makeValueScale,
  type NumericScale,
} from './scales.ts'
import { useAnimationLoop } from './useAnimationLoop.ts'

interface BranchState extends Trajectory {
  start: number
  /* Step index where the peak occurs, precomputed for progress stats. */
  peakStep: number
}

interface SimState {
  branches: BranchState[]
  /* Fractional steps revealed by the shared clock. */
  clock: number
  /* Integer steps already stroked onto the trace canvas. */
  drawnStep: number
  maxSteps: number
  maxPeak: number
  /* Index of the branch with the most steps, highlighted in range mode. */
  longestIdx: number
  overflowed: number
  /* Progressive stats so readouts never spoil the race. */
  longestDoneN: number
  longestDoneSteps: number
  peakSoFarN: number
  peakSoFar: number
  doneAt: number | null
}

interface ViewState {
  layout: ChartLayout
  x: NumericScale
  y: NumericScale
  bg: CanvasRenderingContext2D
  mid: CanvasRenderingContext2D
  fg: CanvasRenderingContext2D
  palette: {
    grid: string
    label: string
    odd: string
    even: string
    record: string
    text: string
    monoFont: string
  }
}

/* Finished runs hold briefly, then replay so the chart keeps moving
   while the page is read. */
const REPLAY_HOLD_MS = 2500

interface TrajectoryCanvasProps {
  config: TrajectoryConfig
  /* Bump to replay the current branches from step zero. */
  restartToken?: number
  /* Bump to jump the clock straight to the finished picture. */
  finishToken?: number
  paused?: boolean
  onReadout?: (readout: TrajectoryReadout) => void
}

export function TrajectoryCanvas({
  config,
  restartToken = 0,
  finishToken = 0,
  paused = false,
  onReadout,
}: TrajectoryCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLCanvasElement>(null)
  const midRef = useRef<HTMLCanvasElement>(null)
  const fgRef = useRef<HTMLCanvasElement>(null)

  const configRef = useRef(config)
  const onReadoutRef = useRef(onReadout)
  const pausedRef = useRef(paused)
  const simRef = useRef<SimState | null>(null)
  const viewRef = useRef<ViewState | null>(null)

  const reduced = useReducedMotion() === true

  useEffect(() => {
    configRef.current = config
    onReadoutRef.current = onReadout
    pausedRef.current = paused
  })

  /* All state the loop touches lives in refs; these helpers close over the
     refs only, so effects registered once stay correct. */
  const helpersRef = useRef<{
    resetSim: () => void
    rebuildView: () => void
    finishRun: () => void
    emitReadout: () => void
    frame: (dt: number) => void
  } | null>(null)

  if (helpersRef.current === null) {
    const resetSim = () => {
      const cfg = configRef.current
      const starts =
        cfg.mode === 'list'
          ? cfg.starts
          : Array.from({ length: cfg.rangeN }, (_, i) => i + 1)
      const branches = starts.map((start) => {
        const t = trajectory(start)
        return { start, peakStep: t.values.indexOf(t.peak), ...t }
      })
      let maxSteps = 1
      let maxPeak = 2
      let longestIdx = 0
      let overflowed = 0
      branches.forEach((branch, i) => {
        if (branch.steps > maxSteps) maxSteps = branch.steps
        if (branch.peak > maxPeak) maxPeak = branch.peak
        if (branch.steps > branches[longestIdx].steps) longestIdx = i
        if (branch.overflowed) overflowed += 1
      })
      simRef.current = {
        branches,
        clock: 0,
        drawnStep: 0,
        maxSteps,
        maxPeak,
        longestIdx,
        overflowed,
        longestDoneN: 0,
        longestDoneSteps: -1,
        peakSoFarN: 0,
        peakSoFar: -1,
        doneAt: null,
      }
    }

    const drawStatic = () => {
      const view = viewRef.current
      if (!view) return
      const cfg = configRef.current
      const sim = simRef.current
      if (!sim) return
      clearCanvas(view.bg, view.layout)
      const yTicks =
        cfg.yMode === 'log2' ? log2TickValues(sim.maxPeak) : view.y.ticks(6)
      drawGrid(view.bg, view.layout, view.y, yTicks, view.palette.grid)
      drawAxes(
        view.bg,
        view.layout,
        view.x,
        view.y,
        yTicks,
        { grid: view.palette.grid, label: view.palette.label },
        view.palette.monoFont,
        {
          x: formatTickLinear,
          y: cfg.yMode === 'log2' ? formatPow2 : formatTickLinear,
        },
      )
    }

    /*
     * Strokes the step range (from, to] for every branch onto the trace
     * canvas. The canvas accumulates: a tick only ever draws the newly
     * revealed segments, so cost tracks the clock, not history length.
     */
    const strokeRange = (from: number, to: number) => {
      const view = viewRef.current
      const sim = simRef.current
      if (!view || !sim || to <= from) return
      const cfg = configRef.current
      for (let i = 0; i < sim.branches.length; i += 1) {
        const branch = sim.branches[i]
        const branchFrom = Math.min(from, branch.steps)
        const branchTo = Math.min(to, branch.steps)
        if (branchTo <= branchFrom) continue
        if (cfg.mode === 'list') {
          drawParitySegments(
            view.mid,
            view.layout,
            view.x,
            view.y,
            branch.values,
            branchFrom,
            branchTo,
            { color: view.palette.odd, width: 2 },
            { color: view.palette.even, width: 2 },
          )
        } else {
          const highlighted = i === sim.longestIdx
          drawPolylineRange(
            view.mid,
            view.layout,
            view.x,
            view.y,
            branch.values,
            branchFrom,
            branchTo,
            highlighted
              ? { color: view.palette.record, width: 2, alpha: 0.9 }
              : { color: view.palette.odd, width: 1, alpha: 0.1 },
          )
        }
      }
    }

    /* Progressive stats: a branch scores when its whole path is visible. */
    const updateProgress = (from: number, to: number) => {
      const sim = simRef.current
      if (!sim) return
      for (const branch of sim.branches) {
        if (branch.steps > from && branch.steps <= to) {
          if (branch.steps > sim.longestDoneSteps) {
            sim.longestDoneSteps = branch.steps
            sim.longestDoneN = branch.start
          }
        }
        /* Peaks count as soon as the peak step itself is revealed. */
        if (branch.peak > sim.peakSoFar && branch.peakStep <= to) {
          sim.peakSoFar = branch.peak
          sim.peakSoFarN = branch.start
        }
      }
    }

    const renderHeads = () => {
      const view = viewRef.current
      const sim = simRef.current
      if (!view || !sim) return
      clearCanvas(view.fg, view.layout)
      if (configRef.current.mode !== 'list') return
      const step = Math.floor(sim.clock)
      for (const branch of sim.branches) {
        if (step >= branch.steps) continue
        drawHead(view.fg, view.x(step), view.y(branch.values[step]), view.palette.text)
      }
    }

    const redrawTraces = () => {
      const view = viewRef.current
      const sim = simRef.current
      if (!view || !sim) return
      clearCanvas(view.mid, view.layout)
      strokeRange(0, sim.drawnStep)
      renderHeads()
    }

    const rebuildView = () => {
      const wrapper = wrapperRef.current
      const bg = bgRef.current
      const mid = midRef.current
      const fg = fgRef.current
      const sim = simRef.current
      if (!wrapper || !bg || !mid || !fg || !sim) return
      const cfg = configRef.current
      const rect = wrapper.getBoundingClientRect()
      const width = Math.max(rect.width, 200)
      const height = Math.max(rect.height, 160)
      const bgCtx = sizeCanvas(bg, width, height)
      const midCtx = sizeCanvas(mid, width, height)
      const fgCtx = sizeCanvas(fg, width, height)
      if (!bgCtx || !midCtx || !fgCtx) return
      const layout: ChartLayout = { width, height, margin: DEFAULT_MARGIN }
      const mono = readToken('--font-mono') || 'monospace'
      viewRef.current = {
        layout,
        x: makeStepScale(sim.maxSteps, [layout.margin.left, width - layout.margin.right]),
        y: makeValueScale(cfg.yMode, sim.maxPeak, [
          height - layout.margin.bottom,
          layout.margin.top,
        ]),
        bg: bgCtx,
        mid: midCtx,
        fg: fgCtx,
        palette: {
          grid: readToken('--line'),
          label: readToken('--text-muted'),
          odd: readToken('--odd'),
          even: readToken('--even'),
          record: readToken('--record'),
          text: readToken('--text'),
          monoFont: `500 11px ${mono}`,
        },
      }
      drawStatic()
      redrawTraces()
    }

    const finishRun = () => {
      const sim = simRef.current
      if (!sim) return
      const from = sim.drawnStep
      sim.clock = sim.maxSteps
      sim.drawnStep = sim.maxSteps
      updateProgress(from, sim.maxSteps)
      strokeRange(from, sim.maxSteps)
      renderHeads()
    }

    const emitReadout = () => {
      const sim = simRef.current
      const emit = onReadoutRef.current
      if (!sim || !emit) return
      const step = Math.floor(sim.clock)
      let running = 0
      for (const branch of sim.branches) {
        if (branch.steps > step) running += 1
      }
      emit({
        step,
        branches: sim.branches.length,
        running,
        longestN: sim.longestDoneN,
        longestSteps: sim.longestDoneSteps,
        peakN: sim.peakSoFarN,
        peakValue: sim.peakSoFar,
        overflowed: sim.overflowed,
        done: step >= sim.maxSteps,
      })
    }

    const frame = (dt: number) => {
      const sim = simRef.current
      if (!sim || pausedRef.current) return
      const cfg = configRef.current
      if (sim.clock < sim.maxSteps) {
        sim.doneAt = null
        sim.clock = Math.min(sim.clock + (cfg.stepsPerSecond * dt) / 1000, sim.maxSteps)
        const step = Math.floor(sim.clock)
        if (step > sim.drawnStep) {
          updateProgress(sim.drawnStep, step)
          strokeRange(sim.drawnStep, step)
          sim.drawnStep = step
        }
        renderHeads()
      } else if (sim.doneAt === null) {
        sim.doneAt = performance.now()
      } else if (performance.now() - sim.doneAt > REPLAY_HOLD_MS) {
        sim.clock = 0
        sim.drawnStep = 0
        sim.doneAt = null
        sim.longestDoneSteps = -1
        sim.longestDoneN = 0
        sim.peakSoFar = -1
        sim.peakSoFarN = 0
        const view = viewRef.current
        if (view) clearCanvas(view.mid, view.layout)
        renderHeads()
      }
    }

    helpersRef.current = { resetSim, rebuildView, finishRun, emitReadout, frame }
  }

  const helpers = helpersRef.current

  /* Full reset: the branches themselves changed, or a replay was requested. */
  const resetKey = [config.mode, config.starts.join(','), config.rangeN, restartToken].join('|')

  useEffect(() => {
    helpers.resetSim()
    helpers.rebuildView()
    if (reduced) helpers.finishRun()
    helpers.emitReadout()
  }, [resetKey, reduced, helpers])

  /* Axis mode change rebuilds scales and redraws; the run continues. */
  useEffect(() => {
    helpers.rebuildView()
  }, [config.yMode, helpers])

  /* Finish jumps to the completed picture without changing the branches. */
  useEffect(() => {
    if (finishToken > 0) {
      helpers.finishRun()
      helpers.emitReadout()
    }
  }, [finishToken, helpers])

  /* Resize and theme switches redraw all layers from current state. */
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

  const label =
    config.mode === 'list'
      ? `Streaming chart of the Collatz trajectories of ${config.starts.join(', ')}, with odd steps in green and even steps in violet`
      : `Streaming chart of the Collatz trajectories of every start up to ${config.rangeN}, with the longest trajectory highlighted`
  return (
    <div ref={wrapperRef} className="chart-canvas" role="img" aria-label={label}>
      <canvas ref={bgRef} aria-hidden="true" />
      <canvas ref={midRef} aria-hidden="true" />
      <canvas ref={fgRef} aria-hidden="true" />
    </div>
  )
}
