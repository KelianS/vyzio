import { useEffect, useReducer } from 'react'
import { Link } from 'react-router'
import { Bell, ChevronRight, Eye, EyeOff, History, Plus } from 'lucide-react'
import type { AppError } from '../../common/errors/app_error'
import { ReadFailure } from '../../common/components/error_message'
import { SecondaryButton } from '../../common/components/secondary_button'
import { Button } from '../../common/ui/button'
import { Surface } from '../../common/components/surface'
import { Loading } from '../../common/components/loading'
import { Skeleton } from '../../common/ui/skeleton'
import { CameraCard } from '../../common/components/camera_card'
import { PressableSurface } from '../../common/components/pressable'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import type { Camera } from '../../domain/entities/camera.entity'
import { liveViewPath } from '../live_view/live_view.route'
import { CAMERA_WALL_ROUTE } from '../camera_wall/camera_wall.route'
import { buildHubPresenter } from './hub.presenter'
import { hubReducer } from './hub.reducer'
import { buildInitialHubUido, type HubUido } from './hub.uido'
import { recentDetectionsLine } from './home_wording'
import { formatHouseEnd } from '../../common/schedule/house_moment'
import { SilenceButton } from './components/silence_button'
import { SilenceSheet } from './components/silence_sheet'
import { HomeTile } from './components/home_tile'

/** From this many cameras, the home shows the first four as a grid (UI-32). */
const GRID_FROM = 4

/** Where the home's one action leads while no camera is added (UI-33). */
const ADD_CAMERA_PATH = '/settings/cameras/add'

export function HubView() {
  const {
    apiBaseUrl,
    hub: container,
    cameras: camerasContainer,
    notifications: notificationsContainer,
  } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(hubReducer, undefined, buildInitialHubUido)
  const presenter = usePresenter(buildHubPresenter, {
    container,
    camerasContainer,
    notificationsContainer,
    dispatch,
    toast,
  })

  const cameras = useRootStore((s) => s.cameras)
  const camerasLoading = useRootStore((s) => s.camerasLoading)
  const camerasError = useRootStore((s) => s.camerasError)
  const frigateStatus = useRootStore((s) => s.systemStats?.status ?? 'active')

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  // A Silence ends by itself at its hour (UC-NOTIF-06 A3): the pill follows without a reload.
  const silenceEnd = uido.silence?.active ? uido.silence.until?.at : undefined
  useEffect(() => {
    if (!silenceEnd) return
    const timer = setTimeout(
      () => void presenter.onSilenceEnded(),
      Math.max(0, Date.parse(silenceEnd) - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [presenter, silenceEnd])

  // An unread list is not an empty one: the first run would invite adding cameras that exist.
  if (camerasError && cameras.length === 0)
    return <HubCamerasUnread error={camerasError} onRetry={presenter.onReloadCameras} />
  // A reload keeps the cards on screen; only the first read shows the home's shape.
  if ((camerasLoading && cameras.length === 0) || !uido.silenceSettled) return <HubLoading />
  if (cameras.length === 0) return <HubNoCamera />

  return (
    <HubOperational
      uido={uido}
      cameras={cameras}
      apiBaseUrl={apiBaseUrl}
      frigateStatus={frigateStatus}
      onTogglePrivacy={(ids, active) => void presenter.onTogglePrivacy(ids, active)}
      onOpenSilence={presenter.onOpenSilence}
      onCloseSilence={presenter.onCloseSilence}
      onStartSilence={(request) => void presenter.onStartSilence(request)}
      onStopSilence={() => void presenter.onStopSilence()}
    />
  )
}

/** The home's shape while it is read: the two pills, two pictures, the two tiles. */
function HubLoading() {
  return (
    <main>
      <h1 className="sr-only">Accueil</h1>
      <Loading className="gap-5 py-0">
        <div className="flex gap-2">
          <Skeleton className="h-11 w-49 rounded-full bg-card" />
          <Skeleton className="h-11 w-28 rounded-full bg-card" />
        </div>
        {[0, 1].map((index) => (
          <div key={index} className="overflow-hidden rounded-card bg-card">
            <Skeleton className="aspect-video rounded-none bg-secondary" />
            <div className="flex h-15 items-center px-4">
              <Skeleton className="h-3.5 w-36 rounded-full bg-icon-circle" />
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-30 rounded-card bg-card" />
          <Skeleton className="h-30 rounded-card bg-card" />
        </div>
      </Loading>
    </main>
  )
}

/** No camera yet: the home is one way to add one, no welcome screen of its own (UI-33). */
function HubNoCamera() {
  return (
    <main className="flex flex-col gap-3">
      <h1 className="sr-only">Accueil</h1>
      <Button asChild size="lg" className="w-full">
        <Link to={ADD_CAMERA_PATH}>
          <Plus aria-hidden="true" />
          Ajouter une caméra
        </Link>
      </Button>
    </main>
  )
}

/** The camera list could not be read: why is in the error, and retrying is the one thing to do. */
function HubCamerasUnread({ error, onRetry }: { error: AppError; onRetry: () => void }) {
  return (
    <main>
      <h1 className="sr-only">Accueil</h1>
      <Surface>
        <ReadFailure
          error={error}
          onRetry={onRetry}
          subject="La liste de vos caméras n’a pas pu être lue."
        />
      </Surface>
    </main>
  )
}

interface HubOperationalProps {
  uido: HubUido
  cameras: Camera[]
  apiBaseUrl: string
  frigateStatus: 'active' | 'restarting' | 'unavailable'
  onTogglePrivacy: (cameraIds: readonly string[], active: boolean) => void
  onOpenSilence: () => void
  onCloseSilence: () => void
  onStartSilence: Parameters<typeof SilenceSheet>[0]['onStart']
  onStopSilence: () => void
}

function HubOperational({
  uido,
  cameras,
  apiBaseUrl,
  frigateStatus,
  onTogglePrivacy,
  onOpenSilence,
  onCloseSilence,
  onStartSilence,
  onStopSilence,
}: HubOperationalProps) {
  const allCut = cameras.every((camera) => camera.privacyModeActive)
  const allIds = cameras.map((camera) => camera.id)
  const busy = new Set(uido.privacyBusyIds)
  const grid = cameras.length >= GRID_FROM
  const shown = grid ? cameras.slice(0, GRID_FROM) : cameras
  const now = new Date()
  const silenceUntil =
    uido.silence?.active && uido.silence.until ? formatHouseEnd(uido.silence.until, now) : null

  return (
    <main className="flex flex-col gap-5">
      <h1 className="sr-only">Accueil</h1>
      <div className="flex flex-wrap gap-2">
        <SecondaryButton
          icon={allCut ? Eye : EyeOff}
          type="button"
          disabled={allIds.some((id) => busy.has(id))}
          onClick={() => onTogglePrivacy(allIds, !allCut)}
        >
          {allCut ? 'Réactiver les caméras' : 'Couper les caméras'}
        </SecondaryButton>
        <SilenceButton
          until={uido.silence?.active ? silenceUntil : null}
          busy={uido.silenceBusy}
          onStart={onOpenSilence}
          onStop={onStopSilence}
        />
      </div>

      <section aria-label="Caméras" className="flex flex-col gap-3">
        <div className={grid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-5'}>
          {shown.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={camera}
              apiBaseUrl={apiBaseUrl}
              frigateStatus={frigateStatus}
              compact={grid}
              liveTo={liveViewPath(camera.id)}
              busy={busy.has(camera.id)}
              onTogglePrivacy={(target, active) => onTogglePrivacy([target.id], active)}
            />
          ))}
        </div>
        {grid && (
          <PressableSurface>
            <Link
              to={CAMERA_WALL_ROUTE}
              className="flex h-13 items-center justify-between rounded-inset bg-card px-4 text-body font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Voir les {cameras.length} caméras
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
            </Link>
          </PressableSurface>
        )}
      </section>

      <nav aria-label="Raccourcis" className="mt-1 grid grid-cols-2 gap-3">
        <HomeTile
          to="/detections"
          icon={History}
          title="Détections"
          subtitle={recentDetectionsLine(uido.recentDetections)}
        />
        <HomeTile
          to="/settings/notifications"
          icon={Bell}
          title="Notifications"
          subtitle={
            silenceUntil
              ? { text: `En silence jusqu’à ${keepTogether(silenceUntil)}`, silence: true }
              : uido.notificationsToConfigure
                ? 'À configurer'
                : null
          }
        />
      </nav>

      {uido.silenceSheetOpen && (
        <SilenceSheet
          scheduleNextChange={uido.silence?.scheduleNextChange ?? null}
          now={now}
          onStart={onStartSilence}
          onClose={onCloseSilence}
        />
      )}
    </main>
  )
}

const NBSP = ' '

/** A narrow tile wraps before the end, never inside « 4 h 39 ». */
function keepTogether(text: string): string {
  return text.replaceAll(' ', NBSP)
}
