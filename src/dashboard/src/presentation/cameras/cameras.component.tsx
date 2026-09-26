import { useParams } from 'react-router'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import { CameraList } from './components/camera_list'
import { CameraPage } from './components/camera_page'
import { buildCamerasPresenter } from './cameras.presenter'

/** The Cameras rubric: the list, then the chosen camera, which the route names (ADR-40). */
export function CamerasView() {
  const { cameraId } = useParams()
  const { cameras: container } = useAppContainer()
  const presenter = usePresenter(buildCamerasPresenter, { container })
  const cameras = useRootStore((state) => state.cameras)
  const loading = useRootStore((state) => state.camerasLoading)
  const error = useRootStore((state) => state.camerasError)

  if (cameraId === undefined)
    return (
      <CameraList cameras={cameras} loading={loading} error={error} onRetry={presenter.onRetry} />
    )

  return (
    <CameraPage
      camera={cameras.find((camera) => camera.id === cameraId)}
      loading={loading}
      error={error}
      onRetry={presenter.onRetry}
    />
  )
}
