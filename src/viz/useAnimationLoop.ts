import { useEffect, useRef } from 'react'

/*
 * Bare requestAnimationFrame loop. The callback lives in a ref so the loop
 * never restarts when the callback identity changes, and dt is clamped so a
 * background tab does not come back with a giant catch-up step.
 */
export function useAnimationLoop(callback: (dtMs: number) => void, running: boolean): void {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    if (!running) return
    let rafId = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(now - last, 100)
      last = now
      callbackRef.current(dt)
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [running])
}
