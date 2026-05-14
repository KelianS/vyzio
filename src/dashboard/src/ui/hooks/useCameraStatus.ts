import { useEffect, useState } from 'react'
import type { CameraStatus } from '../../domain/entities/CameraStatus'
import type { GetCameraStatus } from '../../application/use-cases/GetCameraStatus'

interface CameraStatusState {
  data: CameraStatus | null
  loading: boolean
  error: string | null
}

export function useCameraStatus(useCase: GetCameraStatus, cameraId: string | null) {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<CameraStatusState>({
    data: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!cameraId) {
      setState({ data: null, loading: false, error: null })
      return
    }

    let cancelled = false
    setState({ data: null, loading: true, error: null })

    useCase.execute(cameraId)
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
  }, [cameraId, reloadToken, useCase])

  return {
    ...state,
    reload: () => setReloadToken((value) => value + 1),
    clear: () => setState({ data: null, loading: false, error: null }),
  }
}