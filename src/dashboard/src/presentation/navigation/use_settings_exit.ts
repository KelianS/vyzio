import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { NavigationType, useLocation, useNavigate, useNavigationType } from 'react-router'
import { isLiveViewPath } from '../live_view/live_view.route'
import { isSettingsPath } from '../settings/settings.rubrics'

/** The session's history as the app walked it, and the entry where the settings began. */
interface Trail {
  keys: string[]
  at: number
  entry: number | null
  /** Fermer from a session opened on the settings: popping back to their first entry. */
  popping: boolean
  /** That first entry reached, the home replacing it. */
  replacing: boolean
}

/** What the navigation guard reads of a Fermer under way, and how it drops one it held back. */
export interface SettingsExitSteps {
  /** The pop leaves the settings, though it lands on one of their pages: ask as when leaving. */
  popping: () => boolean
  /** The questions were already asked at the pop. */
  replacing: () => boolean
  forget: () => void
}

/** Leaves the settings where they were entered, popping their pages so Back never returns into them (UI-29). */
export function useSettingsExit(): { close: (() => void) | undefined; steps: SettingsExitSteps } {
  const { key, pathname } = useLocation()
  const type = useNavigationType()
  const navigate = useNavigate()
  const trail = useRef<Trail>({
    keys: [],
    at: -1,
    entry: null,
    popping: false,
    replacing: false,
  })

  useLayoutEffect(() => {
    const walked = trail.current
    const popped = walked.popping
    walked.popping = false
    walked.replacing = false
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

    if (popped && walked.at === 0 && isSettingsPath(pathname)) {
      walked.replacing = true
      void navigate('/', { replace: true })
    }
  }, [key, pathname, type, navigate])

  const close = useCallback(() => {
    const { at, entry } = trail.current
    if (entry === null) return
    if (entry > 0) return void navigate(-(at - entry + 1))
    // Opened on the settings: back to their first page, which the home then replaces.
    if (at === 0) return void navigate('/', { replace: true })
    trail.current.popping = true
    void navigate(-at)
  }, [navigate])

  const steps = useMemo<SettingsExitSteps>(
    () => ({
      popping: () => trail.current.popping,
      replacing: () => trail.current.replacing,
      forget: () => {
        trail.current.popping = false
      },
    }),
    [],
  )

  return { close: isSettingsPath(pathname) ? close : undefined, steps }
}
