import { useState } from 'react'
import type { Camera } from '../../domain/entities/Camera'
import type { AppError } from '../../domain/errors/AppError'
import type { GetCameras } from '../../application/use-cases/GetCameras'
import { useAsync } from './useAsync'

export function useCameras(useCase: GetCameras) {
  const [localData, setLocalData] = useState<Camera[] | null>(null)
  const async_ = useAsync<Camera[]>(() => useCase.execute(), [useCase])

  const data = localData ?? async_.data ?? []

  const removeById = (cameraId: string) => {
    setLocalData((async_.data ?? []).filter((c) => c.id !== cameraId))
  }

  const reload = () => {
    setLocalData(null)
    async_.reload()
  }

  return {
    data,
    loading: async_.loading,
    error: async_.error as AppError | null,
    reload,
    removeById,
  }
}
