import { useEffect } from 'react'
import { useRootStore } from './rootStore'
import type { GetSystemStats } from '../../domain/usecases/GetSystemStats'

const POLL_INTERVAL_MS = 8000

// Polled (not a one-shot fetch): Hub and the live-view overlay both need the Frigate status to
// self-heal ("restarting" → "active") without a manual reload (ADR-33). Mounted once at the app
// shell root so every screen reads the same up-to-date value from the store.
export function useSystemStatsPolling(getSystemStats: GetSystemStats): void {
  useEffect(() => {
    let cancelled = false
    const poll = () => {
      if (!cancelled) void useRootStore.getState().loadSystemStats(getSystemStats)
    }

    poll()
    const intervalId = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [getSystemStats])
}
