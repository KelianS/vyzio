import { useCallback, useEffect, useRef } from 'react'

// The whole document, not the screen alone: the confirmations and toasts it opens live outside it.
function supported(): boolean {
  return (
    document.fullscreenEnabled === true &&
    typeof document.documentElement.requestFullscreen === 'function'
  )
}

function isActive(): boolean {
  return Boolean(document.fullscreenElement)
}

function leave() {
  // A browser that left full screen on its own meanwhile rejects the exit: nothing is left to do.
  if (isActive()) document.exitFullscreen().catch(() => undefined)
}

/**
 * Asks the browser to hide its bars while `wanted`, on the first gesture or from a button (LIVE-10);
 * `onLeft` hears the browser giving them back on its own (LIVE-15).
 */
export function useFullScreen(wanted: boolean, onLeft: () => void) {
  const asked = useRef(false)
  const mounted = useRef(true)
  const left = useRef(onLeft)

  useEffect(() => {
    left.current = onLeft
  }, [onLeft])

  useEffect(() => {
    asked.current = false
    if (!wanted) leave()
  }, [wanted])

  useEffect(() => {
    mounted.current = true
    const onChange = () => {
      if (!isActive()) left.current()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      mounted.current = false
      document.removeEventListener('fullscreenchange', onChange)
      leave()
    }
  }, [])

  const enter = useCallback(() => {
    if (!supported()) return
    asked.current = true
    document.documentElement
      .requestFullscreen()
      // Granted after the screen was left: the page it left must not stay full screen.
      .then(() => {
        if (!mounted.current) leave()
      })
      // Refused when the browser does not count the gesture: the picture still fills the page.
      .catch(() => undefined)
  }, [])

  return {
    enter,
    onGesture: () => {
      if (wanted && !asked.current && !isActive()) enter()
    },
  }
}
