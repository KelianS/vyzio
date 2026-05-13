import { useEffect, useState } from 'react'
import type { Camera } from '../../domain/entities/Camera'
import type { GetCameras } from '../../application/use-cases/GetCameras'

interface CamerasState {
  data: Camera[]
  loading: boolean
  error: string | null
}

export function useCameras(useCase: GetCameras) {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<CamerasState>({
    data: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    setState((current) => ({ ...current, loading: true, error: null }))

    useCase.execute()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: [],
            loading: false,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken, useCase])

  return {
    ...state,
    reload: () => setReloadToken((value) => value + 1),
    removeById: (cameraId: string) => {
      setState((current) => ({
        ...current,
        data: current.data.filter((camera) => camera.id !== cameraId),
      }))
    },
  }
}