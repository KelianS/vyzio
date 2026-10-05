import { useEffect, useReducer, type ReactNode } from 'react'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import { LiveVideo } from './components/live_video'
import { OrientationUnavailable } from '../../common/components/orientation_unavailable'
import { PtzControlPanel } from './components/ptz_control_panel'
import { presetLabel } from './live_view.formatters'
import { buildLiveViewPresenter } from './live_view.presenter'
import { liveViewReducer } from './live_view.reducer'
import { buildInitialLiveViewUido } from './live_view.uido'
import { MOVES, OrientationControl } from '../../common/orientation/orientation_control'
import type { LiveQuality } from '../../domain/entities/camera.entity'

// One surface under the picture, readable over the overlay's dimmed backdrop.
const PANEL =
  'w-full max-w-full overflow-x-auto rounded-card bg-card p-3 text-card-foreground shadow-[var(--shadow-soft)]'

/** The live video and, on a camera that moves, its control: all control happens here (ADR-46). */
export function LiveView({
  cameraId,
  label,
  orientation,
  qualities,
}: {
  cameraId: string
  label: string
  orientation: OrientationControl
  /** The qualities the camera offers; the low one plays first. */
  qualities: LiveQuality[]
}) {
  const { apiBaseUrl, cameras: container } = useAppContainer()
  const { toast } = useToast()
  const frigateStatus = useRootStore((s) => s.systemStats?.status ?? 'active')
  const [uido, dispatch] = useReducer(liveViewReducer, undefined, buildInitialLiveViewUido)
  const presenter = usePresenter(buildLiveViewPresenter, { container, dispatch, toast })

  const usable = MOVES[orientation]

  useEffect(() => {
    if (usable) presenter.onOpen(cameraId)
  }, [presenter, cameraId, usable])

  useEffect(() => presenter.onClose, [presenter])

  const labelOf = (presetId: number) => presetLabel(uido.presets ?? [], presetId)

  const control = (): ReactNode => {
    switch (orientation) {
      case OrientationControl.Off:
        return null
      case OrientationControl.Unusable:
        return (
          <div className={PANEL}>
            <OrientationUnavailable cameraId={cameraId} />
          </div>
        )
      case OrientationControl.Usable:
        return (
          <div className={PANEL}>
            <PtzControlPanel
              cameraId={cameraId}
              apiBaseUrl={apiBaseUrl}
              uido={uido}
              onPress={(direction) => presenter.onPress(cameraId, direction)}
              onRelease={presenter.onRelease}
              onGoTo={(presetId) => void presenter.onGoTo(cameraId, presetId, labelOf(presetId))}
              onSave={(presetId) => void presenter.onSave(cameraId, presetId, labelOf(presetId))}
              onAskOverride={presenter.onAskOverride}
              onCancelOverride={presenter.onCancelOverride}
              onConfirmOverride={(presetId) =>
                presenter.onConfirmOverride(cameraId, presetId, labelOf(presetId))
              }
              onCalibrate={() => void presenter.onCalibrate(cameraId)}
              onRetryPresets={() => presenter.onOpen(cameraId)}
            />
          </div>
        )
      default: {
        const unknown: never = orientation
        return unknown
      }
    }
  }

  return (
    <div className="flex max-w-[90vw] flex-col items-center gap-3">
      <LiveVideo
        cameraId={cameraId}
        apiBaseUrl={apiBaseUrl}
        label={label}
        frigateStatus={frigateStatus}
        quality={uido.quality}
        qualities={qualities}
        soundOn={uido.soundOn}
        onOpen={presenter.openStream}
        onChooseQuality={presenter.onChooseQuality}
        onToggleSound={presenter.onToggleSound}
      />

      {/* Below the image, not overlaid: stacking both on the video crowded a phone in portrait. */}
      {control()}
    </div>
  )
}
