import { useSyncExternalStore } from 'react'

// A phone on its side, for the live full screen (LIVE-10) and the player that stops sticking.
const SIDEWAYS = '(orientation: landscape) and (max-height: 32rem)'

function matches(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(SIDEWAYS).matches
}

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(SIDEWAYS)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Whether the phone is held on its side, following the device as it turns. */
export function useSideways(): boolean {
  return useSyncExternalStore(subscribe, matches)
}
