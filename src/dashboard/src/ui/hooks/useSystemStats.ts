import { useEffect, useState } from 'react'
import type { GetSystemStats } from '../../application/use-cases/GetSystemStats'
import type { SystemStats } from '../../domain/entities/SystemStats'

const POLL_INTERVAL_MS = 8000

// Polled (not a one-shot useAsync): the Hub and the live-view overlay both need the Frigate
// status to self-heal ("restarting" → "active") without a manual reload (ADR-33).
export function useSystemStats(useCase: GetSystemStats) {
  const [data, setData] = useState<SystemStats | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = () => {
      useCase
        .execute()
        .then((stats) => {
          if (!cancelled) setData(stats)
        })
        .catch(() => {})
    }

    poll()
    const intervalId = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [useCase])

  return data
}
