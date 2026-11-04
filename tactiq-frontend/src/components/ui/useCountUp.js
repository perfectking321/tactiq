import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animates a number from its previous value to `value` (~600 ms, skipped with reduced motion). */
export function useCountUp(value, duration = 600) {
  const [shown, setShown] = useState(() => (reduced() || value === null || value === undefined ? value : 0))
  const from = useRef(shown)
  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value) || reduced()) {
      from.current = value
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(value)
      return undefined
    }
    const start = typeof from.current === 'number' ? from.current : 0
    const t0 = performance.now()
    let raf = 0
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - p) ** 3
      const v = start + (value - start) * eased
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return shown
}

