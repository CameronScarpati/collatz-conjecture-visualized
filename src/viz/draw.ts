import type { NumericScale } from './scales.ts'

/*
 * Pure canvas primitives. Every function takes its context and reads
 * nothing global, so the three views share one drawing vocabulary and
 * none of it needs React to test or reason about.
 */

export interface Margin {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ChartLayout {
  width: number
  height: number
  margin: Margin
}

export interface PlotArea {
  x: number
  y: number
  w: number
  h: number
}

export const DEFAULT_MARGIN: Margin = { top: 18, right: 20, bottom: 30, left: 58 }

export function plotArea(layout: ChartLayout): PlotArea {
  const { width, height, margin } = layout
  return {
    x: margin.left,
    y: margin.top,
    w: Math.max(0, width - margin.left - margin.right),
    h: Math.max(0, height - margin.top - margin.bottom),
  }
}

export function clearCanvas(ctx: CanvasRenderingContext2D, layout: ChartLayout): void {
  ctx.clearRect(0, 0, layout.width, layout.height)
}

/* Backing store at device resolution, drawing in CSS pixel coordinates. */
export function sizeCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

/* Half-pixel offset keeps 1px hairlines crisp after the dpr transform. */
export function crisp(v: number): number {
  return Math.round(v) + 0.5
}

export interface AxisColors {
  grid: string
  label: string
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  yScale: NumericScale,
  tickValues: number[],
  color: string,
): void {
  const area = plotArea(layout)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const t of tickValues) {
    const y = crisp(yScale(t))
    ctx.moveTo(area.x, y)
    ctx.lineTo(area.x + area.w, y)
  }
  ctx.stroke()
  ctx.restore()
}

export interface TickFormatters {
  x: (value: number) => string
  y: (value: number) => string
}

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  xScale: NumericScale,
  yScale: NumericScale,
  yTicks: number[],
  colors: AxisColors,
  font: string,
  format: TickFormatters,
  xTicks?: number[],
): void {
  const area = plotArea(layout)
  ctx.save()
  ctx.font = font
  ctx.fillStyle = colors.label
  ctx.strokeStyle = colors.grid
  ctx.lineWidth = 1

  const baseline = crisp(area.y + area.h)
  ctx.beginPath()
  ctx.moveTo(area.x, baseline)
  ctx.lineTo(area.x + area.w, baseline)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const t of xTicks ?? xScale.ticks(6)) {
    if (!Number.isInteger(t)) continue
    const x = xScale(t)
    ctx.beginPath()
    ctx.moveTo(crisp(x), baseline)
    ctx.lineTo(crisp(x), baseline + 4)
    ctx.stroke()
    ctx.fillText(format.x(t), x, baseline + 7)
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const t of yTicks) {
    ctx.fillText(format.y(t), area.x - 8, yScale(t))
  }
  ctx.restore()
}

export interface TraceStyle {
  color: string
  width: number
  alpha?: number
  dash?: number[]
}

/*
 * Incremental parity-colored strokes: each step from values[i] draws in
 * the color of the move leaving it. Segments batch into one path per
 * parity so a tick costs two strokes regardless of step count.
 */
export function drawParitySegments(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  xScale: NumericScale,
  yScale: NumericScale,
  values: Float64Array,
  fromStep: number,
  toStep: number,
  oddStyle: TraceStyle,
  evenStyle: TraceStyle,
): void {
  if (toStep <= fromStep) return
  const area = plotArea(layout)
  ctx.save()
  ctx.beginPath()
  ctx.rect(area.x, area.y, area.w, area.h)
  ctx.clip()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const parity of [1, 0]) {
    const style = parity === 1 ? oddStyle : evenStyle
    ctx.strokeStyle = style.color
    ctx.lineWidth = style.width
    ctx.globalAlpha = style.alpha ?? 1
    ctx.beginPath()
    for (let i = fromStep; i < toStep; i += 1) {
      if (values[i] % 2 !== parity) continue
      ctx.moveTo(xScale(i), yScale(values[i]))
      ctx.lineTo(xScale(i + 1), yScale(values[i + 1]))
    }
    ctx.stroke()
  }
  ctx.restore()
}

/* Single-color polyline over a step range, for the low-alpha range mode. */
export function drawPolylineRange(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  xScale: NumericScale,
  yScale: NumericScale,
  values: Float64Array,
  fromStep: number,
  toStep: number,
  style: TraceStyle,
): void {
  if (toStep <= fromStep) return
  const area = plotArea(layout)
  ctx.save()
  ctx.beginPath()
  ctx.rect(area.x, area.y, area.w, area.h)
  ctx.clip()
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.width
  ctx.globalAlpha = style.alpha ?? 1
  ctx.setLineDash(style.dash ?? [])
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(xScale(fromStep), yScale(values[fromStep]))
  for (let i = fromStep + 1; i <= toStep; i += 1) {
    ctx.lineTo(xScale(i), yScale(values[i]))
  }
  ctx.stroke()
  ctx.restore()
}

/*
 * Full trace redraw for rebuilds. Min-max envelope per pixel column once
 * points outnumber pixels: caps the path at two points per column while
 * preserving every spike, which stride sampling would silently drop.
 */
export function drawTrace(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  xScale: NumericScale,
  yScale: NumericScale,
  values: Float64Array,
  count: number,
  style: TraceStyle,
): void {
  if (count < 2) return
  const area = plotArea(layout)
  ctx.save()
  ctx.beginPath()
  ctx.rect(area.x, area.y, area.w, area.h)
  ctx.clip()
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.width
  ctx.globalAlpha = style.alpha ?? 1
  ctx.setLineDash(style.dash ?? [])
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (count > area.w * 2) {
    decimatedPath(ctx, xScale, yScale, values, count)
  } else {
    ctx.moveTo(xScale(0), yScale(values[0]))
    for (let i = 1; i < count; i += 1) {
      ctx.lineTo(xScale(i), yScale(values[i]))
    }
  }
  ctx.stroke()
  ctx.restore()
}

function decimatedPath(
  ctx: CanvasRenderingContext2D,
  xScale: NumericScale,
  yScale: NumericScale,
  values: Float64Array,
  count: number,
): void {
  let col = Math.round(xScale(0))
  let min = values[0]
  let max = values[0]
  let started = false
  const emit = (x: number, lo: number, hi: number) => {
    const yLo = yScale(lo)
    if (started) ctx.lineTo(x, yLo)
    else {
      ctx.moveTo(x, yLo)
      started = true
    }
    const yHi = yScale(hi)
    if (yHi !== yLo) ctx.lineTo(x, yHi)
  }
  for (let i = 1; i < count; i += 1) {
    const v = values[i]
    const x = Math.round(xScale(i))
    if (x === col) {
      if (v < min) min = v
      if (v > max) max = v
      continue
    }
    emit(col, min, max)
    col = x
    min = v
    max = v
  }
  emit(col, min, max)
}

/* The comet head marking where an animating branch currently is. */
export function drawHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius = 3,
): void {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export interface MarkerPoint {
  x: number
  y: number
  label: string
}

export interface MarkerStyle {
  color: string
  /* Casing stroke behind the label so it stays legible over data. */
  casing: string
  font: string
}

/*
 * Record annotations: a small ring with the label beside it. Labels skip
 * neighbors closer than 70px; the rings remain. Two passes so a later
 * ring never stamps over an earlier label.
 */
export function drawRecordMarkers(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  points: MarkerPoint[],
  style: MarkerStyle,
): void {
  if (points.length === 0) return
  const area = plotArea(layout)
  ctx.save()
  ctx.font = style.font

  ctx.strokeStyle = style.color
  ctx.lineWidth = 1.5
  for (const point of points) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.fillStyle = style.color
  let lastLabelX = -Infinity
  for (const point of points) {
    if (Math.abs(point.x - lastLabelX) < 70) continue
    lastLabelX = point.x
    const alignRight = point.x > area.x + area.w - 90
    ctx.textAlign = alignRight ? 'right' : 'left'
    ctx.textBaseline = 'bottom'
    const labelX = point.x + (alignRight ? -8 : 8)
    const labelY = point.y - 5
    ctx.lineWidth = 3
    ctx.strokeStyle = style.casing
    ctx.strokeText(point.label, labelX, labelY)
    ctx.fillText(point.label, labelX, labelY)
  }
  ctx.restore()
}

/* Histogram bars, drawn once when a stats run completes. */
export function drawBars(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  xScale: NumericScale,
  yScale: NumericScale,
  bins: Uint32Array,
  binWidth: number,
  color: string,
): void {
  const area = plotArea(layout)
  const bottom = area.y + area.h
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i < bins.length; i += 1) {
    if (bins[i] === 0) continue
    const x0 = xScale(i * binWidth)
    const x1 = xScale((i + 1) * binWidth)
    const y = yScale(bins[i])
    ctx.fillRect(x0 + 0.5, y, Math.max(1, x1 - x0 - 1), bottom - y)
  }
  ctx.restore()
}
