/* ResizeObserver never fires when only devicePixelRatio changes (the window
   dragged to a monitor with a different pixel density, or a zoom change), so
   the backing store keeps the stale density and the canvas goes soft. MDN's
   pattern: listen on a resolution media query matching the current ratio and
   re-arm after every change, because each query is ratio-specific. */
export function watchDevicePixelRatio(onChange: () => void): () => void {
  let query: MediaQueryList | null = null
  const listener = () => {
    onChange()
    arm()
  }
  const arm = () => {
    query?.removeEventListener('change', listener)
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    query.addEventListener('change', listener)
  }
  arm()
  return () => {
    query?.removeEventListener('change', listener)
  }
}
