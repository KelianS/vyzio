import { useReducer } from 'react'
import { CameraCard } from '../../common/components/camera_card'
import { ReadFailure } from '../../common/components/error_message'
import { Loading } from '../../common/components/loading'
import { PageHeader } from '../../common/components/page_header'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import { liveViewPath } from '../live_view/live_view.route'
import { buildCameraWallPresenter } from './camera_wall.presenter'
import { cameraWallReducer } from './camera_wall.reducer'
import { buildInitialCameraWallUido } from './camera_wall.uido'

/** Every camera, each with its mark and its eye: viewing, never configuring (UI-06, UC-UI-01 A2). */
export function CameraWallView() {
  const { apiBaseUrl, cameras: camerasContainer } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(cameraWallReducer, undefined, buildInitialCameraWallUido)
  const presenter = usePresenter(buildCameraWallPresenter, { camerasContainer, dispatch, toast })

  const cameras = useRootStore((s) => s.cameras)
  const camerasLoading = useRootStore((s) => s.camerasLoading)
  const camerasError = useRootStore((s) => s.camerasError)
  const frigateStatus = useRootStore((s) => s.systemStats?.status ?? 'active')

  return (
    <main>
      <PageHeader title="Caméras" />
      {camerasError && cameras.length === 0 ? (
        <ReadFailure
          error={camerasError}
          onRetry={presenter.onReloadCameras}
          subject="La liste de vos caméras n’a pas pu être lue."
        />
      ) : camerasLoading && cameras.length === 0 ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {cameras.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={camera}
              apiBaseUrl={apiBaseUrl}
              frigateStatus={frigateStatus}
              compact
              liveTo={liveViewPath(camera.id)}
              busy={uido.privacyBusyIds.includes(camera.id)}
              onTogglePrivacy={(target, active) =>
                void presenter.onTogglePrivacy(target.id, active)
              }
            />
          ))}
        </div>
      )}
    </main>
  )
}
