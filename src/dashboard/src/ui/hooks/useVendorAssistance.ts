import { useEffect, useState } from 'react'
import type { VendorAssistance } from '../../domain/entities/VendorAssistance'
import type { GetVendorAssistance } from '../../application/use-cases/GetVendorAssistance'

interface VendorAssistanceState {
  data: VendorAssistance | null
  loading: boolean
  error: string | null
}

export function useVendorAssistance(
  useCase: GetVendorAssistance,
  vendorFamily: string | null,
  streamPath: string | null,
  connected: boolean,
) {
  const [state, setState] = useState<VendorAssistanceState>({
    data: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!vendorFamily) {
      setState({ data: null, loading: false, error: null })
      return
    }

    let cancelled = false
    setState({ data: null, loading: true, error: null })

    useCase.execute({ vendorFamily, streamPath, connected })
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [connected, streamPath, useCase, vendorFamily])

  return state
}