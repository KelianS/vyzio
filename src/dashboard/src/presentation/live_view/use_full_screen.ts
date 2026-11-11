import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

// The whole document, not the screen alone: the confirmations and toasts it opens live outside it.
function supported(): boolean {
  return (
    document.fullscreenEnabled === true &&
    typeof document.documentElement.requestFullscreen === 'function'
  )
}

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

function isActive(): boolean {
  return Boolean(document.fullscreenElement)
}

function leave() {
  // A browser that left full screen on its own meanwhile rejects the exit: nothing is left to do.
  if (isActive()) document.exitFullscreen().catch(() => undefined)
}

/** Asks the browser to hide its bars while `wanted`, on the first gesture or from a button (SPECS 7.2). */
export function useFullScreen(wanted: boolean) {
  const active = useSyncExternalStore(subscribe, isActive)
  const asked = useRef(false)

  useEffect(() => {
    asked.current = false
    if (!wanted) leave()
  }, [wanted])

  useEffect(() => leave, [])

  const enter = useCallback(() => {
    asked.current = true
    // Refused when the browser does not count the gesture: the button stays offered.
    document.documentElement.requestFullscreen().catch(() => undefined)
  }, [])

  const offered = wanted && !active && supported()

  return {
    offered,
    enter,
    onGesture: () => {
      if (offered && !asked.current) enter()
    },
  }
}
