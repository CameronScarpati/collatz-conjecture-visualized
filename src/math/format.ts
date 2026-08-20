/* Number formatting shared by axis labels and readouts. */

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function superscript(exponent: number): string {
  return String(exponent)
    .split('')
    .map((digit) => SUPERSCRIPTS[Number(digit)])
    .join('')
}

/* Grouped integer for readouts and labels: 9232 -> "9,232". */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/*
 * Compact labels for linear axes: exact below a thousand, then k and M.
 * Values arrive from tick generators, so they divide cleanly.
 */
export function formatTickLinear(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${trimmed(value / 1_000)}k`
  if (value < 1_000_000_000) return `${trimmed(value / 1_000_000)}M`
  return value.toExponential(0).replace('e+', 'e')
}

function trimmed(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/*
 * Labels for the log2 axis, where every tick is a power of two. Small
 * powers read as plain numbers; from 2^10 up the honest label is the
 * power itself, since "1k" would misname 1024.
 */
export function formatPow2(value: number): string {
  const exponent = Math.round(Math.log2(value))
  if (exponent < 10) return String(value)
  return `2${superscript(exponent)}`
}

/* Readout values: grouped while short, exponential once they get long. */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return 'n/a'
  if (value < 10_000_000) return formatInt(value)
  return value.toExponential(2).replace('e+', 'e')
}
