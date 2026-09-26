import { useEffect, useReducer } from 'react'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import { LiveImage } from './components/live_image'
import { PtzControlPanel } from './components/ptz_control_panel'
import { presetLabel } from './live_view.formatters'
import { buildLiveViewPresenter } from './live_view.presenter'
import { liveViewReducer } from './live_view.reducer'
import { buildInitialLiveViewUido } from './live_view.uido'

/** The live picture and, on a camera that moves, its control: all control happens here (ADR-46). */
export function LiveView({
  cameraId,
  label,
  ptzSupported,
}: {
  cameraId: string
  label: string
  ptzSupported: boolean
}) {
  const { apiBaseUrl, cameras: container } = useAppContainer()
  const { toast } = useToast()
  const frigateStatus = useRootStore((s) => s.systemStats?.status ?? 'active')
  const [uido, dispatch] = useReducer(liveViewReducer, undefined, buildInitialLiveViewUido)
  const presenter = usePresenter(buildLiveViewPresenter, { container, dispatch, toast })

  useEffect(() => {
    if (ptzSupported) presenter.onOpen(cameraId)
  }, [presenter, cameraId, ptzSupported])

  useEffect(() => presenter.onClose, [presenter])

  const labelOf = (presetId: number) => presetLabel(uido.presets, presetId)

  return (
    <div className="flex max-w-[90vw] flex-col items-center gap-3">
      <LiveImage
        cameraId={cameraId}
        apiBaseUrl={apiBaseUrl}
        label={label}
        frigateStatus={frigateStatus}
      />

      {/* Below the image, not overlaid: stacking both on the video crowded a phone in portrait. */}
      {ptzSupported && (
        <div className="w-full max-w-full overflow-x-auto rounded-card bg-card p-3 text-card-foreground shadow-[var(--shadow-soft)]">
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
          />
        </div>
      )}
    </div>
  )
}
