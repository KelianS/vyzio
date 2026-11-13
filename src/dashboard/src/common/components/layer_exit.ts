import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'

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

/** Plays a removed layer's exit on a lifeless copy of it, its backdrop included, then drops the copy. */
function leaveAsGhost(parts: Element[]) {
  for (const part of parts) {
    const ghost = part.cloneNode(true) as HTMLElement
    ghost.setAttribute('data-state', 'closed')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.inert = true
    ghost.style.pointerEvents = 'none'
    document.body.append(ghost)
    whenStill(ghost, () => ghost.remove())
  }
}

/**
 * A layer its caller mounts while it shows: closing plays its exit, then hands back to the caller.
 * When the caller unmounts it first, once an action settles, the exit plays on a copy.
 */
export function useLayerExit<T extends Element>(onClosed: () => void) {
  const [open, setOpen] = useState(true)
  // State, not a ref: the portal renders the layer a render after this hook first runs.
  const [layer, setLayer] = useState<T | null>(null)
  const openRef = useRef(open)
  const handedBack = useRef(false)
  const closed = useEffectEvent(() => {
    if (handedBack.current) return
    handedBack.current = true
    onClosed()
  })

  useEffect(() => {
    openRef.current = open
    if (open) return
    return whenStill(layer, closed)
  }, [open, layer])

  useLayoutEffect(() => {
    if (!layer) return
    return () => {
      if (!openRef.current) return
      const backdrop = layer.previousElementSibling
      const parts = backdrop?.getAttribute('data-slot')?.endsWith('-overlay')
        ? [backdrop, layer]
        : [layer]
      // Still on the page once the cleanup is over: a remount, not a removal.
      queueMicrotask(() => {
        if (!layer.isConnected) leaveAsGhost(parts)
      })
    }
  }, [layer])

  return { open, ref: setLayer, close: () => setOpen(false) }
}
