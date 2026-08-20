import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import type { TreeConfig, TreeReadout } from '../config.ts'
import { growCoral, type Coral } from '../math/tree.ts'
import { readToken } from '../theme/theme.ts'
import { clearCanvas, sizeCanvas, type ChartLayout } from './draw.ts'
import { useAnimationLoop } from './useAnimationLoop.ts'

interface SimState {
  coral: Coral
  /* Node positions projected to screen pixels, fixed camera. */
  screenX: Float32Array
  screenY: Float32Array
  /* Fractional depth levels revealed by the clock. */
  clock: number
  drawnLevel: number
  totalDepth: number
  doneAt: number | null
}

interface ViewState {
  layout: ChartLayout
  bg: CanvasRenderingContext2D
  fg: CanvasRenderingContext2D
  palette: {
    trunk: [number, number, number]
    tips: [number, number, number]
    text: string
    surface: string
    monoFont: string
  }
}

const REPLAY_HOLD_MS = 2500
const FIT_PADDING = 24

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`
}

interface TreeCanvasProps {
  config: TreeConfig
  restartToken?: number
  finishToken?: number
  paused?: boolean
  onReadout?: (readout: TreeReadout) => void
}

export function TreeCanvas({
  config,
  restartToken = 0,
  finishToken = 0,
  paused = false,
  onReadout,
}: TreeCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLCanvasElement>(null)
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
      const coral = growCoral({
        evenAngleDeg: cfg.evenAngleDeg,
        oddAngleDeg: cfg.oddAngleDeg,
        maxDepth: cfg.maxDepth,
      })
      simRef.current = {
        coral,
        screenX: new Float32Array(coral.nodes.length),
        screenY: new Float32Array(coral.nodes.length),
        clock: 0,
        drawnLevel: 0,
        totalDepth: coral.levelOffsets.length - 2,
        doneAt: null,
      }
    }

    /*
     * The camera never moves: the layout is projected once against the
     * final bounding box, so the coral grows into a stable frame instead
     * of reflowing under the viewer.
     */
    const project = () => {
      const sim = simRef.current
      const view = viewRef.current
      if (!sim || !view) return
      const { bbox, nodes } = sim.coral
      const spanX = Math.max(bbox.maxX - bbox.minX, 1e-6)
      const spanY = Math.max(bbox.maxY - bbox.minY, 1e-6)
      const usableW = view.layout.width - FIT_PADDING * 2
      const usableH = view.layout.height - FIT_PADDING * 2
      const scale = Math.min(usableW / spanX, usableH / spanY)
      const offsetX = FIT_PADDING + (usableW - spanX * scale) / 2
      const offsetY = FIT_PADDING + (usableH - spanY * scale) / 2
      for (let i = 0; i < nodes.length; i += 1) {
        sim.screenX[i] = offsetX + (nodes[i].x - bbox.minX) * scale
        /* Flip y: the layout grows upward, canvas y grows downward. */
        sim.screenY[i] = offsetY + (bbox.maxY - nodes[i].y) * scale
      }
    }

    const drawRoot = () => {
      const sim = simRef.current
      const view = viewRef.current
      if (!sim || !view) return
      clearCanvas(view.bg, view.layout)
      const x = sim.screenX[0]
      const y = sim.screenY[0]
      view.bg.save()
      view.bg.fillStyle = view.palette.text
      view.bg.beginPath()
      view.bg.arc(x, y, 3, 0, Math.PI * 2)
      view.bg.fill()
      view.bg.font = view.palette.monoFont
      view.bg.textAlign = 'center'
      view.bg.textBaseline = 'top'
      view.bg.lineWidth = 3
      view.bg.strokeStyle = view.palette.surface
      view.bg.strokeText('1', x, y + 6)
      view.bg.fillText('1', x, y + 6)
      view.bg.restore()
    }

    /* Strokes the edges arriving at each depth in (fromLevel, toLevel]. */
    const strokeLevels = (fromLevel: number, toLevel: number) => {
      const sim = simRef.current
      const view = viewRef.current
      if (!sim || !view) return
      const cfg = configRef.current
      const { levelOffsets, nodes } = sim.coral
      const ctx = view.fg
      ctx.save()
      ctx.lineCap = 'round'
      for (let level = fromLevel + 1; level <= toLevel; level += 1) {
        if (level + 1 >= levelOffsets.length) break
        const t = cfg.maxDepth > 0 ? level / cfg.maxDepth : 0
        ctx.strokeStyle = lerpColor(view.palette.trunk, view.palette.tips, t)
        ctx.lineWidth = Math.max(0.75, 3 * Math.pow(0.93, level))
        ctx.beginPath()
        for (let i = levelOffsets[level]; i < levelOffsets[level + 1]; i += 1) {
          const parent = nodes[i].parent
          ctx.moveTo(sim.screenX[parent], sim.screenY[parent])
          ctx.lineTo(sim.screenX[i], sim.screenY[i])
        }
        ctx.stroke()
        if (cfg.labelSmall && level <= 12) {
          ctx.font = view.palette.monoFont
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          for (let i = levelOffsets[level]; i < levelOffsets[level + 1]; i += 1) {
            if (nodes[i].value >= 100) continue
            const label = String(nodes[i].value)
            ctx.lineWidth = 3
            ctx.strokeStyle = view.palette.surface
            ctx.strokeText(label, sim.screenX[i], sim.screenY[i])
            ctx.fillStyle = view.palette.text
            ctx.fillText(label, sim.screenX[i], sim.screenY[i])
          }
        }
      }
      ctx.restore()
    }

    const redrawAll = () => {
      const sim = simRef.current
      const view = viewRef.current
      if (!sim || !view) return
      drawRoot()
      clearCanvas(view.fg, view.layout)
      strokeLevels(0, sim.drawnLevel)
    }

    const rebuildView = () => {
      const wrapper = wrapperRef.current
      const bg = bgRef.current
      const fg = fgRef.current
      const sim = simRef.current
      if (!wrapper || !bg || !fg || !sim) return
      const rect = wrapper.getBoundingClientRect()
      const width = Math.max(rect.width, 200)
      const height = Math.max(rect.height, 160)
      const bgCtx = sizeCanvas(bg, width, height)
      const fgCtx = sizeCanvas(fg, width, height)
      if (!bgCtx || !fgCtx) return
      const mono = readToken('--font-mono') || 'monospace'
      viewRef.current = {
        layout: { width, height, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
        bg: bgCtx,
        fg: fgCtx,
        palette: {
          trunk: parseHex(readToken('--even')),
          tips: parseHex(readToken('--odd')),
          text: readToken('--text'),
          surface: readToken('--surface'),
          monoFont: `500 11px ${mono}`,
        },
      }
      project()
      redrawAll()
    }

    const finishRun = () => {
      const sim = simRef.current
      if (!sim) return
      const from = sim.drawnLevel
      sim.clock = sim.totalDepth
      sim.drawnLevel = sim.totalDepth
      strokeLevels(from, sim.totalDepth)
    }

    const emitReadout = () => {
      const sim = simRef.current
      const emit = onReadoutRef.current
      if (!sim || !emit) return
      const { levelOffsets, nodes } = sim.coral
      const upto = Math.min(sim.drawnLevel + 1, levelOffsets.length - 1)
      emit({
        nodesDrawn: levelOffsets[upto],
        depthDrawn: sim.drawnLevel,
        totalNodes: nodes.length,
        totalDepth: sim.totalDepth,
        done: sim.drawnLevel >= sim.totalDepth,
      })
    }

    const frame = (dt: number) => {
      const sim = simRef.current
      if (!sim || pausedRef.current) return
      const cfg = configRef.current
      if (sim.clock < sim.totalDepth) {
        sim.doneAt = null
        sim.clock = Math.min(sim.clock + (cfg.levelsPerSecond * dt) / 1000, sim.totalDepth)
        const level = Math.floor(sim.clock)
        if (level > sim.drawnLevel) {
          strokeLevels(sim.drawnLevel, level)
          sim.drawnLevel = level
        }
      } else if (sim.doneAt === null) {
        sim.doneAt = performance.now()
      } else if (performance.now() - sim.doneAt > REPLAY_HOLD_MS) {
        sim.clock = 0
        sim.drawnLevel = 0
        sim.doneAt = null
        const view = viewRef.current
        if (view) clearCanvas(view.fg, view.layout)
      }
    }

    helpersRef.current = { resetSim, rebuildView, finishRun, emitReadout, frame }
  }

  const helpers = helpersRef.current

  const resetKey = [
    config.evenAngleDeg,
    config.oddAngleDeg,
    config.maxDepth,
    restartToken,
  ].join('|')

  useEffect(() => {
    helpers.resetSim()
    helpers.rebuildView()
    if (reduced) helpers.finishRun()
    helpers.emitReadout()
  }, [resetKey, reduced, helpers])

  /* Label toggle redraws what is already grown; growth is untouched. */
  useEffect(() => {
    helpers.rebuildView()
  }, [config.labelSmall, helpers])

  useEffect(() => {
    if (finishToken > 0) {
      helpers.finishRun()
      helpers.emitReadout()
    }
  }, [finishToken, helpers])

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
    <div
      ref={wrapperRef}
      className="chart-canvas"
      role="img"
      aria-label={`The reverse Collatz tree grown from 1 to depth ${config.maxDepth}, drawn as a coral whose edges bend by parity: violet doubling runs curl one way and green odd branches kick the other`}
    >
      <canvas ref={bgRef} aria-hidden="true" />
      <canvas ref={fgRef} aria-hidden="true" />
    </div>
  )
}
