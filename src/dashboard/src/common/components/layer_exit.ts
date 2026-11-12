import { useEffect, useEffectEvent, useRef, useState } from 'react'

/** Calls `done` once the animations `element` is playing have finished, at once when none is. */
export function whenStill(element: Element | null, done: () => void): () => void {
  const running =
    element && typeof element.getAnimations === 'function' ? element.getAnimations() : []
  if (running.length === 0) {
    done()
    return () => undefined
  }
  let waiting = true
  void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
    if (waiting) done()
  })
  return () => {
    waiting = false
  }
}

/** A layer its caller mounts while it shows: closing plays its exit, then hands back to the caller. */
export function useLayerExit<T extends Element>(onClosed: () => void) {
  const [open, setOpen] = useState(true)
  const ref = useRef<T>(null)
  const closed = useEffectEvent(onClosed)

  useEffect(() => {
    if (open) return
    return whenStill(ref.current, closed)
  }, [open])

  return { open, ref, close: () => setOpen(false) }
}
