import { useSyncExternalStore } from 'react'

/** How the live view lays out its picture and controls (LIVE-09, LIVE-10). */
export const LiveLayout = {
  Portrait: 'portrait',
  Landscape: 'landscape',
  Wide: 'wide',
} as const

export type LiveLayout = (typeof LiveLayout)[keyof typeof LiveLayout]

// A phone on its side: too short to keep the controls off the picture.
const LANDSCAPE = '(orientation: landscape) and (max-height: 32rem)'
const WIDE = '(min-width: 64rem)'

function matches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

function currentLayout(): LiveLayout {
  if (matches(LANDSCAPE)) return LiveLayout.Landscape
  if (matches(WIDE)) return LiveLayout.Wide
  return LiveLayout.Portrait
}

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const queries = [LANDSCAPE, WIDE].map((query) => window.matchMedia(query))
  queries.forEach((query) => query.addEventListener('change', onChange))
  return () => queries.forEach((query) => query.removeEventListener('change', onChange))
}

/** Held upright, the bar sits above the picture and never covers it (LIVE-09). */
export const BAR_ABOVE: Record<LiveLayout, boolean> = {
  portrait: true,
  landscape: false,
  wide: false,
}

/** Follows the device as it turns. */
export function useLiveLayout(): LiveLayout {
  return useSyncExternalStore(subscribe, currentLayout)
}
