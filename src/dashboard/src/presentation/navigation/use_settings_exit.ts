import { useCallback, useLayoutEffect, useRef } from 'react'
import { NavigationType, useLocation, useNavigate, useNavigationType } from 'react-router'
import { isLiveViewPath } from '../live_view/live_view.route'
import { isSettingsPath } from '../settings/settings.rubrics'

/** The session's history as the app walked it, and the entry where the settings began. */
interface Trail {
  keys: string[]
  at: number
  entry: number | null
}

/** Leaves the settings where they were entered, popping their pages so Back never returns into them (UI-29). */
export function useSettingsExit(): (() => void) | undefined {
  const { key, pathname } = useLocation()
  const type = useNavigationType()
  const navigate = useNavigate()
  const trail = useRef<Trail>({ keys: [], at: -1, entry: null })

  useLayoutEffect(() => {
    const walked = trail.current
    const known = walked.keys.indexOf(key)
    if (type === NavigationType.Push) {
      walked.keys = [...walked.keys.slice(0, walked.at + 1), key]
      walked.at = walked.keys.length - 1
    } else if (type === NavigationType.Replace && walked.at >= 0) {
      walked.keys[walked.at] = key
    } else if (known >= 0) {
      walked.at = known
    } else {
      // An entry the app never saw, such as the one it opened on: the walk starts again here.
      walked.keys = [key]
      walked.at = 0
      walked.entry = null
    }

    if (isSettingsPath(pathname))
      walked.entry = walked.entry === null ? walked.at : Math.min(walked.entry, walked.at)
    // Driving the camera from its page is a detour that keeps the way out (LIVE-19).
    else if (!isLiveViewPath(pathname)) walked.entry = null
  }, [key, pathname, type])

  const close = useCallback(() => {
    const { at, entry } = trail.current
    if (entry === null) return
    // Opened on the settings: nothing of the app lies behind them but the home.
    if (entry === 0) void navigate('/', { replace: true })
    else void navigate(-(at - entry + 1))
  }, [navigate])

  return isSettingsPath(pathname) ? close : undefined
}
