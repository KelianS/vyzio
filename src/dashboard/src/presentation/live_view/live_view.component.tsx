import { useEffect, useReducer, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useToast } from '../../common/components/toast'
import { ReadFailure } from '../../common/components/error_message'
import { LiveWaitVeil } from '../../common/components/live_wait_veil'
import { usePresenter } from '../../common/presenter/use_presenter'
import { cn } from '../../common/ui/utils'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import { LiveVideo } from './components/live_video'
import { LiveTopBar } from './components/live_top_bar'
import { OrientationUnavailable } from '../../common/components/orientation_unavailable'
import { PtzControlPanel } from './components/ptz_control_panel'
import { CAMERA_REMOVED, PRIVACY_STOPS_LIVE, presetLabel } from './live_view.formatters'
import { buildLiveViewPresenter } from './live_view.presenter'
import { liveViewReducer } from './live_view.reducer'
import { buildInitialLiveViewUido } from './live_view.uido'
import { LiveAccess, liveAccessOf } from './live_access'
import { BAR_ABOVE, LiveLayout, useLiveLayout } from './live_layout'
import { useAutoHide } from './use_auto_hide'
import { useFullScreen } from './use_full_screen'
import { useViewportFitCover } from './use_viewport_fit_cover'
import {
  MOVES,
  OrientationControl,
  orientationControlOf,
} from '../../common/orientation/orientation_control'
import { buildCamerasPresenter } from '../cameras/cameras.presenter'
import type { LiveQuality } from '../../domain/entities/camera.entity'

// Edge to edge on every layout; 100dvh where the browser keeps its bars (LIVE-10).
const SCREEN = 'fixed inset-x-0 top-0 z-40 h-dvh'

const LAYOUT: Record<LiveLayout, { screen: string; picture: string; controls: string }> = {
  // The controls fill the height the picture leaves, so they can centre in it.
  portrait: {
    screen: 'flex flex-col overflow-y-auto bg-background',
    picture: 'w-full shrink-0',
    controls: 'flex flex-1 flex-col px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
  },
  // The controls place themselves over the picture.
  landscape: {
    screen: 'bg-surface-inverse',
    picture: 'absolute inset-0',
    controls: '',
  },
  wide: {
    screen: 'flex flex-row bg-background',
    picture: 'relative min-w-0 flex-1',
    controls: 'w-88 shrink-0 overflow-y-auto p-6',
  },
}

// Over the picture in landscape, never faded: it explains why there is no joystick.
const UNAVAILABLE: Record<LiveLayout, string> = {
  portrait: '',
  landscape:
    'absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-card bg-card p-3',
  wide: '',
}

const AUTO_HIDE: Record<LiveLayout, boolean> = { portrait: false, landscape: true, wide: false }

/** Back where the user came from; home when the address was opened directly (LIVE-07). */
function useBack() {
  const navigate = useNavigate()
  const location = useLocation()
  // react-router's key for the first entry of the history it manages.
  const reachedDirectly = location.key === 'default'
  return () => void (reachedDirectly ? navigate('/') : navigate(-1))
}

// Where what keeps the camera from showing is said and fixed (LIVE-11).
function CameraPageLink({ cameraId }: { cameraId: string }) {
  return (
    <Link
      to={`/settings/cameras/${cameraId}`}
      className="underline underline-offset-2 hover:no-underline"
    >
      Ouvrir sa page
    </Link>
  )
}

/** The live view's route: the camera its address names, once the gates a thumbnail applies are passed. */
export function LiveViewScreen() {
  const { cameraId = '' } = useParams()
  const { cameras: container } = useAppContainer()
  const presenter = usePresenter(buildCamerasPresenter, { container })
  const cameras = useRootStore((s) => s.cameras)
  const loading = useRootStore((s) => s.camerasLoading)
  const error = useRootStore((s) => s.camerasError)
  const back = useBack()
  useViewportFitCover()

  const camera = cameras.find((c) => c.id === cameraId)
  const access = liveAccessOf(camera, { loading, unread: error !== null })
  const label = camera?.displayName ?? ''

  const closed = (body: ReactNode) => (
    <main aria-label={label || 'Direct'} className={cn(SCREEN, 'bg-surface-inverse')}>
      <div className="flex size-full items-center justify-center px-6 text-center text-surface-inverse-foreground">
        {body}
      </div>
      <LiveTopBar label={label} shown onBack={back} />
    </main>
  )

  switch (access) {
    case LiveAccess.Loading:
      return closed(<LiveWaitVeil message="Chargement…" />)
    case LiveAccess.Unread:
      return closed(
        error && (
          <div className="rounded-card bg-card p-4 text-left text-card-foreground">
            <ReadFailure
              error={error}
              onRetry={presenter.onRetry}
              subject="La liste de vos caméras n’a pas pu être lue."
            />
          </div>
        ),
      )
    case LiveAccess.Removed:
      return closed(<p>{CAMERA_REMOVED}</p>)
    case LiveAccess.Privacy:
      return closed(<p>{PRIVACY_STOPS_LIVE}</p>)
    case LiveAccess.Unwatched:
      return closed(
        <p>
          Cette caméra est à configurer : elle n’a pas encore de vue en direct.{' '}
          <CameraPageLink cameraId={cameraId} />
        </p>,
      )
    case LiveAccess.Offline:
      return closed(
        <p>
          Cette caméra est hors ligne : pas de vue en direct pour le moment.{' '}
          <CameraPageLink cameraId={cameraId} />
        </p>,
      )
    case LiveAccess.Open:
      return (
        camera && (
          <LiveView
            cameraId={camera.id}
            label={camera.displayName}
            orientation={orientationControlOf(camera)}
            qualities={camera.liveQualities}
          />
        )
      )
    default: {
      const unknown: never = access
      return unknown
    }
  }
}

/** The live video and, on a camera that moves, its control: all control happens here (ADR-09). */
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
  const layout = useLiveLayout()
  const controls = useAutoHide(AUTO_HIDE[layout])
  const fullScreen = useFullScreen(AUTO_HIDE[layout])
  const back = useBack()

  const usable = MOVES[orientation]

  useEffect(() => {
    if (usable) presenter.onOpen(cameraId)
  }, [presenter, cameraId, usable])

  useEffect(() => presenter.onClose, [presenter])

  // A key brings the faded controls back, wherever the focus fell when they faded.
  const reveal = controls.reveal
  useEffect(() => {
    window.addEventListener('keydown', reveal)
    return () => window.removeEventListener('keydown', reveal)
  }, [reveal])

  const labelOf = (presetId: number) => presetLabel(uido.presets ?? [], presetId)

  const control = (): ReactNode => {
    switch (orientation) {
      case OrientationControl.Off:
        return null
      case OrientationControl.Unusable:
        return (
          <div className={UNAVAILABLE[layout]}>
            <OrientationUnavailable cameraId={cameraId} />
          </div>
        )
      case OrientationControl.Usable:
        return (
          <PtzControlPanel
            layout={layout}
            shown={controls.shown}
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
        )
      default: {
        const unknown: never = orientation
        return unknown
      }
    }
  }

  const body = control()
  const place = LAYOUT[layout]

  return (
    <main
      aria-label={label}
      className={cn(SCREEN, place.screen)}
      onPointerDownCapture={controls.hold}
      onPointerUpCapture={controls.release}
      onPointerCancelCapture={controls.release}
      onFocusCapture={controls.reveal}
      onClick={fullScreen.onGesture}
    >
      <div className={place.picture}>
        <LiveVideo
          cameraId={cameraId}
          apiBaseUrl={apiBaseUrl}
          label={label}
          frigateStatus={frigateStatus}
          quality={uido.quality}
          qualities={qualities}
          soundOn={uido.soundOn}
          layout={layout}
          bar={(pictureControls) => (
            <LiveTopBar
              label={label}
              shown={controls.shown}
              above={BAR_ABOVE[layout]}
              onBack={back}
              onFullScreen={fullScreen.offered ? fullScreen.enter : undefined}
              onLeaveFullScreen={fullScreen.leave}
            >
              {pictureControls}
            </LiveTopBar>
          )}
          onOpen={presenter.openStream}
          onChooseQuality={presenter.onChooseQuality}
          onToggleSound={presenter.onToggleSound}
        />
      </div>

      {body && <div className={place.controls}>{body}</div>}
    </main>
  )
}
