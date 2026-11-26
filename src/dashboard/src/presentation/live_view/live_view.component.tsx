import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Eye, EyeOff, Maximize, Minimize, Settings, WifiOff } from 'lucide-react'
import { useToast } from '../../common/components/toast'
import { ReadFailure } from '../../common/components/error_message'
import { Loading } from '../../common/components/loading'
import { PageHeader } from '../../common/components/page_header'
import { PressableControl } from '../../common/components/pressable'
import { SecondaryButton } from '../../common/components/secondary_button'
import { StatusMark } from '../../common/components/status_mark'
import { TechnicalDetails } from '../../common/components/technical_details'
import { TopBarIconLink } from '../../common/components/top_bar'
import { OrientationUnavailable } from '../../common/components/orientation_unavailable'
import { ClipPlayer } from '../../common/detection/clip_player'
import { cameraMark, cutLine } from '../../common/camera/camera_status'
import { usePresenter } from '../../common/presenter/use_presenter'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import {
  MOVES,
  OrientationControl,
  orientationControlOf,
} from '../../common/orientation/orientation_control'
import type { Camera } from '../../domain/entities/camera.entity'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import { buildCamerasPresenter } from '../cameras/cameras.presenter'
import { CameraClips } from './components/camera_clips'
import { LIVE_CONTROL } from './components/live_control'
import { fading } from '../../common/motion/fading'
import { LiveVideo } from './components/live_video'
import { PictureNotice } from './components/picture_notice'
import { PtzPad, type PadVariant } from './components/ptz_pad'
import { PtzPositions } from './components/ptz_positions'
import { ViewTabs } from './components/view_tabs'
import { ViewTab, viewTabOf } from './components/view_tab'
import { LiveAccess, liveAccessOf } from './live_access'
import { CAMERA_REMOVED, presetLabel } from './live_view.formatters'
import { useSideways } from './live_layout'
import { buildLiveViewPresenter } from './live_view.presenter'
import { liveViewReducer } from './live_view.reducer'
import { buildInitialLiveViewUido } from './live_view.uido'
import { useAutoHide } from '../../common/motion/use_auto_hide'
import { useFullScreen } from './use_full_screen'
import { useViewportFitCover } from './use_viewport_fit_cover'

/** What takes the picture's place: the live, or why there is none (PRIV-20, LIVE-23). */
const PictureState = {
  Live: 'live',
  Cut: 'cut',
  Offline: 'offline',
} as const

type PictureState = (typeof PictureState)[keyof typeof PictureState]

function pictureStateOf(camera: Camera): PictureState {
  if (camera.privacyModeActive) return PictureState.Cut
  if (!camera.connected) return PictureState.Offline
  return PictureState.Live
}

const lastSeen = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

function seenAt(value: string | null): string {
  return value ? lastSeen.format(new Date(value)) : 'jamais'
}

/** The camera view's route: the camera its address names, once the gates a card applies are passed. */
export function LiveViewScreen() {
  const { cameraId = '' } = useParams()
  const { cameras: container } = useAppContainer()
  const presenter = usePresenter(buildCamerasPresenter, { container })
  const cameras = useRootStore((s) => s.cameras)
  const loading = useRootStore((s) => s.camerasLoading)
  const error = useRootStore((s) => s.camerasError)
  useViewportFitCover()

  const camera = cameras.find((c) => c.id === cameraId)
  const access = liveAccessOf(camera, { loading, unread: error !== null })

  switch (access) {
    case LiveAccess.Loading:
      return <Loading />
    case LiveAccess.Unread:
      return (
        <>
          <PageHeader title="Caméra" />
          {error && (
            <ReadFailure
              error={error}
              onRetry={presenter.onRetry}
              subject="La liste de vos caméras n’a pas pu être lue."
            />
          )}
        </>
      )
    case LiveAccess.Removed:
      return (
        <>
          <PageHeader title="Caméra" />
          <p className="text-body text-muted-foreground">{CAMERA_REMOVED}</p>
        </>
      )
    // Where what keeps the camera from showing is said and fixed (LIVE-23).
    case LiveAccess.Unwatched:
      return (
        camera && (
          <>
            <CameraHeader camera={camera} />
            <PictureNotice icon={Settings} title="À configurer">
              <p className="text-body text-muted-foreground">
                Cette caméra n’a pas encore d’image en direct.{' '}
                <Link
                  to={`/settings/cameras/${camera.id}`}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  Ouvrir sa page
                </Link>
              </p>
            </PictureNotice>
          </>
        )
      )
    case LiveAccess.Privacy:
    case LiveAccess.Offline:
    case LiveAccess.Open:
      return camera && <LiveView camera={camera} />
    default: {
      const unknown: never = access
      return unknown
    }
  }
}

/** The camera's name with its mark, and the gear to its settings (LIVE-19). */
function CameraHeader({ camera }: { camera: Camera }) {
  return (
    <PageHeader
      title={camera.displayName}
      mark={cameraMark(camera)}
      action={
        <TopBarIconLink
          to={`/settings/cameras/${camera.id}`}
          label="Réglages de la caméra"
          icon={Settings}
        />
      }
    />
  )
}

/**
 * The camera view (LIVE-19): the picture, then Contrôles and Détections. Upright the picture sits in
 * the page; on its side, or from « Plein écran », it goes edge to edge with the controls over it (LIVE-22).
 */
export function LiveView({ camera }: { camera: Camera }) {
  const { apiBaseUrl, cameras: container, detectionHistory: history } = useAppContainer()
  const { toast } = useToast()
  const frigateStatus = useRootStore((s) => s.systemStats?.status ?? 'active')
  const [uido, dispatch] = useReducer(liveViewReducer, undefined, buildInitialLiveViewUido)
  const presenter = usePresenter(buildLiveViewPresenter, { container, history, dispatch, toast })
  const [params, setParams] = useSearchParams()
  const tab = viewTabOf(params.get('tab'))

  const cameraId = camera.id
  const picture = pictureStateOf(camera)
  const orientation = orientationControlOf(camera)
  const playing = uido.clips?.find((clip) => clip.eventId === uido.playingId) ?? null
  const live = picture === PictureState.Live && playing === null
  const steerable = MOVES[orientation] && picture === PictureState.Live

  // Full screen: the phone on its side, unless the user left it, or asked from the button.
  const sideways = useSideways()
  const [asked, setAsked] = useState(false)
  const [keptUpright, setKeptUpright] = useState(false)
  const [wasSideways, setWasSideways] = useState(sideways)
  if (sideways !== wasSideways) {
    setWasSideways(sideways)
    setKeptUpright(false)
    if (!sideways) setAsked(false)
  }
  const immersive = live && ((sideways && !keptUpright) || asked)
  const controls = useAutoHide(immersive)
  const browserLeft = useCallback(() => setAsked(false), [])
  const fullScreen = useFullScreen(immersive, browserLeft)

  useEffect(() => {
    if (steerable) presenter.onOpen(cameraId)
  }, [presenter, cameraId, steerable])

  useEffect(() => presenter.onClose, [presenter])

  const frigateName = camera.frigateCameraName
  useEffect(() => {
    presenter.onOpenClips(frigateName)
  }, [presenter, frigateName])

  const enterFullScreen = () => {
    setAsked(true)
    fullScreen.enter()
  }
  const leaveFullScreen = () => {
    setAsked(false)
    if (sideways) setKeptUpright(true)
  }

  const labelOf = (presetId: number) => presetLabel(uido.presets ?? [], presetId)
  const chooseTab = (next: ViewTab) =>
    setParams(next === ViewTab.Controls ? {} : { tab: next }, { replace: true })

  const pad = (variant: PadVariant) => (
    <PtzPad
      variant={variant}
      onPress={(direction) => presenter.onPress(cameraId, direction)}
      onRelease={presenter.onRelease}
    />
  )

  const positions = (variant: PadVariant) => (
    <PtzPositions
      variant={variant}
      shown={controls.shown}
      cameraId={cameraId}
      apiBaseUrl={apiBaseUrl}
      uido={uido}
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

  const cut = (
    <SecondaryButton
      icon={EyeOff}
      type="button"
      size="lg"
      className="w-full"
      disabled={uido.privacyBusy}
      onClick={() => void presenter.onSetPrivacy(cameraId, true)}
    >
      Couper la caméra
    </SecondaryButton>
  )

  const controlsPanel = (): ReactNode => {
    switch (picture) {
      case PictureState.Cut:
        return (
          <p className="px-5 text-center text-body text-muted-foreground">
            Les contrôles reviennent quand la caméra est réactivée.
          </p>
        )
      case PictureState.Offline:
        return (
          <div className="flex flex-col gap-6">
            <p className="px-5 text-center text-body text-muted-foreground">
              Les contrôles reviennent quand la caméra répond de nouveau.
            </p>
            {cut}
          </div>
        )
      case PictureState.Live:
        return (
          <div className="flex flex-col gap-6">
            {orientation === OrientationControl.Usable && (
              <>
                <div className="flex justify-center">{pad('solid')}</div>
                <section aria-label="Positions" className="flex flex-col gap-2">
                  <h2 className="ml-1 text-label font-semibold text-muted-foreground">Positions</h2>
                  {positions('solid')}
                </section>
              </>
            )}
            {orientation === OrientationControl.Unusable && (
              <OrientationUnavailable cameraId={cameraId} />
            )}
            {cut}
          </div>
        )
      default: {
        const unknown: never = picture
        return unknown
      }
    }
  }

  const fade = fading(controls.shown)

  // Laid over the live picture: its own controls upright, the whole set edge to edge (LIVE-21, LIVE-22).
  const overlay = (pictureControls: ReactNode) =>
    immersive ? (
      <>
        <div
          {...fade}
          data-press-only
          className={cn(
            'absolute inset-x-0 top-0 flex items-center gap-2 px-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))]',
            fade.className,
          )}
        >
          <p className="flex h-9 min-w-0 items-center gap-2 rounded-full bg-glass px-3.5 text-body font-semibold">
            <StatusMark {...cameraMark(camera)} />
            <span className="truncate">{camera.displayName}</span>
          </p>
          <span className="flex-1" />
          {pictureControls}
          <PressableControl>
            <button
              type="button"
              className={LIVE_CONTROL}
              aria-label="Quitter le plein écran"
              onClick={(event) => {
                // Leaving is not a gesture to go full screen: the screen would ask for it as it goes.
                event.stopPropagation()
                leaveFullScreen()
              }}
            >
              <Minimize className="size-5" aria-hidden="true" />
            </button>
          </PressableControl>
        </div>
        {orientation === OrientationControl.Usable && (
          <>
            <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] max-w-[calc(100%-14rem)]">
              {positions('glass')}
            </div>
            <div
              {...fade}
              className={cn(
                'absolute right-[max(1.5rem,env(safe-area-inset-right))] bottom-[max(1.5rem,env(safe-area-inset-bottom))]',
                fade.className,
              )}
            >
              {pad('glass')}
            </div>
          </>
        )}
        {/* Never faded: it explains why there is no pad. */}
        {orientation === OrientationControl.Unusable && (
          <div className="absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-card bg-card p-3">
            <OrientationUnavailable cameraId={cameraId} />
          </div>
        )}
      </>
    ) : (
      <div className="absolute right-2.5 bottom-2.5 flex gap-2" data-press-only>
        {pictureControls}
        <PressableControl>
          <button
            type="button"
            className={LIVE_CONTROL}
            aria-label="Plein écran"
            onClick={enterFullScreen}
          >
            <Maximize className="size-5" aria-hidden="true" />
          </button>
        </PressableControl>
      </div>
    )

  const well = (): ReactNode => {
    if (playing)
      return (
        <ClipPlayer
          key={playing.eventId}
          event={playing}
          labels={uido.clipLabels}
          apiBaseUrl={apiBaseUrl}
          clipGone={uido.clipGoneId === playing.eventId}
          className="aspect-video w-full rounded-card"
          onVideoError={() => void presenter.onClipFailed(playing.eventId)}
        >
          <PressableControl>
            <button
              type="button"
              onClick={presenter.onBackToLive}
              className="absolute top-2.5 left-2.5 flex h-11 items-center gap-2 rounded-full bg-glass px-4 text-label font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              Revenir au direct
            </button>
          </PressableControl>
        </ClipPlayer>
      )
    switch (picture) {
      case PictureState.Cut:
        return (
          <PictureNotice icon={EyeOff} title={cutLine(camera, new Date())}>
            <p className="-mt-2.5 text-body text-muted-foreground">Vyzio n’enregistre plus rien</p>
            <Button
              type="button"
              disabled={uido.privacyBusy}
              onClick={() => void presenter.onSetPrivacy(cameraId, false)}
            >
              <Eye aria-hidden="true" />
              Réactiver
            </Button>
          </PictureNotice>
        )
      case PictureState.Offline:
        return (
          <PictureNotice icon={WifiOff} title="Hors ligne">
            <p className="-mt-2.5 text-body text-muted-foreground">
              Cette caméra ne répond pas : vérifiez qu’elle est allumée et reliée au réseau.
            </p>
            <div className="w-full text-left">
              <TechnicalDetails>
                <p>Dernière image reçue : {seenAt(camera.lastSuccessfulFrameAt)}</p>
                <p>Dernière vérification : {seenAt(camera.lastReachabilityCheckAt)}</p>
                <p>Adresse : {camera.host}</p>
              </TechnicalDetails>
            </div>
          </PictureNotice>
        )
      case PictureState.Live:
        return (
          <LiveVideo
            cameraId={cameraId}
            apiBaseUrl={apiBaseUrl}
            label={camera.displayName}
            frigateStatus={frigateStatus}
            quality={uido.quality}
            qualities={camera.liveQualities}
            soundOn={uido.soundOn}
            immersive={immersive}
            overlay={overlay}
            onOpen={presenter.openStream}
            onChooseQuality={presenter.onChooseQuality}
            onToggleSound={presenter.onToggleSound}
          />
        )
      default: {
        const unknown: never = picture
        return unknown
      }
    }
  }

  return (
    // Not a document: a pull never reloads it and cuts the stream, a double tap never zooms (index.css).
    <main
      data-live
      aria-label={camera.displayName}
      className="flex touch-manipulation flex-col gap-4"
    >
      <CameraHeader camera={camera} />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        {/* One element in both framings: the stream it holds survives a turn of the phone (LIVE-16). */}
        <div
          className={cn(
            immersive ? 'fixed inset-0 z-40 touch-manipulation bg-picture' : 'relative w-full',
          )}
          onPointerDownCapture={immersive ? controls.hold : undefined}
          onPointerUpCapture={immersive ? controls.release : undefined}
          onPointerCancelCapture={immersive ? controls.release : undefined}
          onFocusCapture={immersive ? controls.reveal : undefined}
          onClick={fullScreen.onGesture}
        >
          {well()}
        </div>

        {/* Edge to edge, the controls lie over the picture: the tabs would steer twice. */}
        {!immersive && (
          <ViewTabs current={tab} onChoose={chooseTab}>
            {tab === ViewTab.Controls ? (
              controlsPanel()
            ) : (
              <CameraClips
                clips={uido.clips}
                error={uido.clipsError}
                labels={uido.clipLabels}
                apiBaseUrl={apiBaseUrl}
                playingId={uido.playingId}
                allTo={`/detections?camera=${encodeURIComponent(cameraId)}`}
                onPlay={(event) => presenter.onPlayClip(event.eventId)}
                onRetry={() => presenter.onOpenClips(frigateName)}
              />
            )}
          </ViewTabs>
        )}
      </div>
    </main>
  )
}
