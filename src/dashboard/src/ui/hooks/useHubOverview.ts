import { useEffect, useState } from 'react'
import type { HubOverview } from '../../domain/entities/HubOverview'
import type { GetHubOverview } from '../../application/use-cases/GetHubOverview'

interface HubOverviewState {
  data: HubOverview | null
  loading: boolean
  error: string | null
}

export function useHubOverview(useCase: GetHubOverview) {
  const [state, setState] = useState<HubOverviewState>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    setState((current) => ({
      data: current.data,
      loading: true,
      error: null,
    }))

    useCase
      .execute()
      .then((data) => {
        if (cancelled) {
          return
        }

        setState({
          data,
          loading: false,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        })
      })

    return () => {
      cancelled = true
    }
  }, [useCase])

  return state
}