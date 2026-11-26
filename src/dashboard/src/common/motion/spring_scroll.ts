import { motionValue } from 'motion/react'
import { prefersReducedMotion, springTo } from './springs'

/** Where the page scrolls so `row` shows whole below `clearTop`, the nearest way; null when it does. */
export function nearestScrollTop(
  row: { top: number; bottom: number },
  clearTop: number,
  viewport: number,
  scrollY: number,
): number | null {
  if (row.top < clearTop) return scrollY + row.top - clearTop
  if (row.bottom > viewport) return scrollY + row.bottom - viewport
  return null
}

/**
 * Brings `element` into view the nearest way, clear of its `scroll-margin-top`, on the arrival
 * spring; at once when the phone asks for less motion. Returns how to stop it.
 */
export function springIntoView(element: HTMLElement): () => void {
  const clearTop = parseFloat(getComputedStyle(element).scrollMarginTop) || 0
  const top = nearestScrollTop(
    element.getBoundingClientRect(),
    clearTop,
    window.innerHeight,
    window.scrollY,
  )
  if (top === null) return () => undefined
  if (prefersReducedMotion()) {
    window.scrollTo(0, top)
    return () => undefined
  }
  const position = motionValue(window.scrollY)
  const unsubscribe = position.on('change', (y) => window.scrollTo(0, y))
  const motion = springTo(position, top, 'arrival')
  const stop = () => {
    motion.stop()
    unsubscribe()
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchstart', stop)
  }
  // A finger or a wheel takes the page back at once.
  window.addEventListener('wheel', stop, { passive: true })
  window.addEventListener('touchstart', stop, { passive: true })
  void motion.then(stop)
  return stop
}
