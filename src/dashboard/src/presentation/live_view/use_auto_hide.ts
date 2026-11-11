import { useCallback, useEffect, useRef, useState } from 'react'

const HIDE_AFTER_MS = 3000

/** Controls over the picture fade without a gesture, never while a finger holds one (SPECS 7.2). */
export function useAutoHide(enabled: boolean) {
  const [hidden, setHidden] = useState(false)
  const [wasEnabled, setWasEnabled] = useState(enabled)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)

  // Turning the device shows the controls again.
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled)
    setHidden(false)
  }

  const disarm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const arm = useCallback(() => {
    disarm()
    if (!held.current) timer.current = setTimeout(() => setHidden(true), HIDE_AFTER_MS)
  }, [disarm])

  useEffect(() => {
    if (!enabled) return
    arm()
    return disarm
  }, [enabled, arm, disarm])

  return {
    shown: !enabled || !hidden,
    hold: () => {
      held.current = true
      disarm()
      setHidden(false)
    },
    release: () => {
      held.current = false
      if (enabled) arm()
    },
  }
}
