import type { GetCameraStatus } from '../../domain/usecases/GetCameraStatus'
import { useAsync } from '../../common/hooks/useAsync'

export function useCameraStatus(useCase: GetCameraStatus, cameraId: string | null) {
  const result = useAsync(() => useCase.execute(cameraId!), [useCase, cameraId], {
    initialLoading: false,
    skip: !cameraId,
  })

  return {
    ...result,
    clear: () => result.reload(),
  }
}
