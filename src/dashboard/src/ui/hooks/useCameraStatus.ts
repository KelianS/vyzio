import type { CameraStatus } from '../../domain/entities/CameraStatus'
import type { GetCameraStatus } from '../../application/use-cases/GetCameraStatus'
import { useAsync } from './useAsync'

export function useCameraStatus(useCase: GetCameraStatus, cameraId: string | null) {
  const result = useAsync(
    () => useCase.execute(cameraId!),
    [useCase, cameraId],
    { initialLoading: false, skip: !cameraId },
  )

  return {
    ...result,
    clear: () => result.reload(),
  }
}
