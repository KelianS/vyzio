import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { appErrorMessage, type AppError } from '../../common/errors/AppError'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { Overlay } from '../../common/components/Overlay'
import { CameraLiveThumbnail } from '../../common/components/CameraLiveThumbnail'
import { LiveFeedModal } from '../../common/components/LiveFeedModal'
import { useToast } from '../../common/components/Toast'
import { usePresenter } from '../../common/presenter/usePresenter'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { Camera } from '../../domain/entities/Camera'
import type { HubOverview } from '../../domain/entities/HubOverview'
import type { SystemStats } from '../../domain/entities/SystemStats'
import { DetectionList } from '../../common/detection/DetectionList'
import { formatEventTime } from '../../common/detection/detectionFormatters'
import { SystemMonitorPanel } from './SystemMonitorPanel'
import { buildHubPresenter } from './Hub.Presenter'
import { hubReducer } from './Hub.Reducer'
import { buildInitialHubUido } from './Hub.Uido'
import { privacyWording, type PrivacyRequest } from './privacyRequest'

/** L'accueil ne montre que les dernieres ; l'historique montre les memes, toutes. */
const RECENT_EVENTS_MAX = 5

type ModalMedia =
  | { type: 'image' | 'video'; url: string }
  | { type: 'live'; cameraId: string; label: string; ptzSupported: boolean }

export function HubView() {
  const { apiBaseUrl, hub: container, cameras: camerasContainer } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(hubReducer, undefined, buildInitialHubUido)
  const presenter = usePresenter(buildHubPresenter, {
    container,
    camerasContainer,
    dispatch,
    toast,
  })

  const cameras = useRootStore((s) => s.cameras)
  const camerasLoading = useRootStore((s) => s.camerasLoading)
  const systemStats = useRootStore((s) => s.systemStats)

  const [modalMedia, setModalMedia] = useState<ModalMedia | null>(null)

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  if (uido.loading || camerasLoading) return <HubLoading />
  if (uido.error || !uido.data?.systemHealthy) return <HubUnreachable error={uido.error} />
  if (cameras.length === 0) return <HubWelcome />

  return (
    <>
      <HubOperational
        data={uido.data}
        cameras={cameras}
        apiBaseUrl={apiBaseUrl}
        systemStats={systemStats}
        privacyPending={uido.privacyPending}
        privacyLoading={uido.privacyLoading}
        onPrivacyPendingSet={presenter.onPrivacyPendingSet}
        onTogglePrivacy={presenter.onTogglePrivacy}
        onOpenMedia={(type, url) => setModalMedia({ type, url })}
        onOpenLive={(camera) =>
          setModalMedia({
            type: 'live',
            cameraId: camera.id,
            label: camera.displayName,
            ptzSupported: camera.ptzSupported,
          })
        }
      />

      {modalMedia && (
        <Overlay label="Aperçu" onClose={() => setModalMedia(null)}>
          {modalMedia.type === 'live' ? (
            <LiveFeedModal
              cameraId={modalMedia.cameraId}
              apiBaseUrl={apiBaseUrl}
              label={modalMedia.label}
              ptzSupported={modalMedia.ptzSupported}
              frigateStatus={systemStats?.status ?? 'active'}
              ptzStep={camerasContainer.ptzStep}
              ptzGoToPreset={camerasContainer.ptzGoToPreset}
              getPtzPresets={camerasContainer.getPtzPresets}
              ptzSaveCurrentAsPreset={camerasContainer.ptzSaveCurrentAsPreset}
              capturePtzPresetThumbnail={camerasContainer.capturePtzPresetThumbnail}
              ptzCalibrate={camerasContainer.ptzCalibrate}
            />
          ) : modalMedia.type === 'image' ? (
            <img src={modalMedia.url} alt="" className="max-h-[85vh] rounded-lg" />
          ) : (
            <video src={modalMedia.url} controls autoPlay className="max-h-[85vh] rounded-lg" />
          )}
        </Overlay>
      )}
    </>
  )
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-card bg-card p-5 text-card-foreground shadow-[var(--shadow-soft)] sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  )
}

function HubLoading() {
  return (
    <main className="flex flex-col gap-4 py-4" aria-label="Chargement">
      <div className="h-24 animate-pulse rounded-card bg-card" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-40 animate-pulse rounded-card bg-card" />
        <div className="h-40 animate-pulse rounded-card bg-card" />
        <div className="h-40 animate-pulse rounded-card bg-card" />
      </div>
    </main>
  )
}

/** Vyzio unreachable: name the failure and what to check. */
function HubUnreachable({ error }: { error: AppError | null }) {
  return (
    <main className="py-4">
      <Card>
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-1 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h1 className="font-serif text-3xl">Vyzio ne répond pas</h1>
            <p className="mt-1 text-muted-foreground">
              La surveillance continue peut-être, mais cette page ne peut pas le confirmer.
            </p>

            <p className="mt-5 font-medium">À vérifier :</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Le boîtier Vyzio est allumé et connecté au réseau.</li>
              <li>Vous êtes sur le même réseau que lui.</li>
              <li>Son adresse n’a pas changé.</li>
            </ol>

            {error && <p className="mt-4 text-sm text-destructive">{appErrorMessage(error)}</p>}
          </div>
        </div>
      </Card>
    </main>
  )
}

const WELCOME_STEPS = [
  {
    title: 'Ajouter une caméra',
    body: 'Vyzio la cherche sur votre réseau, ou vous donnez son adresse.',
  },
  {
    title: 'Choisir ce qui compte',
    body: 'Personnes, animaux, véhicules : à vous de dire ce qui mérite une alerte.',
  },
  { title: 'Être prévenu', body: 'Les alertes arrivent sur Telegram, aux heures que vous fixez.' },
]

function HubWelcome() {
  return (
    <main className="py-4">
      <Card>
        <h1 className="font-serif text-3xl">Bienvenue</h1>
        <p className="mt-1 text-muted-foreground">
          Trois étapes, et vos caméras sont sous surveillance.
        </p>

        <ol className="mt-6 grid gap-5 sm:grid-cols-3">
          {WELCOME_STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="flex size-8 items-center justify-center rounded-full bg-muted font-medium">
                {index + 1}
              </span>
              <p className="mt-2 font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/settings/cameras/ajout">Ajouter une caméra</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/settings/notifications">Configurer les alertes</Link>
          </Button>
        </div>
      </Card>
    </main>
  )
}

interface HubOperationalProps {
  data: HubOverview
  cameras: Camera[]
  apiBaseUrl: string
  systemStats: SystemStats | null
  privacyPending: PrivacyRequest | null
  privacyLoading: boolean
  onPrivacyPendingSet: (request: PrivacyRequest | null) => void
  onTogglePrivacy: (request: PrivacyRequest) => void
  onOpenMedia: (type: 'image' | 'video', url: string) => void
  onOpenLive: (camera: Camera) => void
}

function HubOperational({
  data,
  cameras,
  apiBaseUrl,
  systemStats,
  privacyPending,
  privacyLoading,
  onPrivacyPendingSet,
  onTogglePrivacy,
  onOpenMedia,
  onOpenLive,
}: HubOperationalProps) {
  const frigateStatus = systemStats?.status ?? 'active'
  const allPrivate = cameras.every((camera) => camera.privacyModeActive)
  // L'attente se montre sur la vignette concernee, pas seulement dans la modale : couper touche la
  // camera elle-meme, et rien ne bouge a l'ecran avant qu'elle ait repondu.
  const privacyBusyIds = new Set(privacyLoading ? (privacyPending?.cameraIds ?? []) : [])
  const watched = cameras.filter((camera) => camera.isEnabled && !camera.privacyModeActive).length

  return (
    <main className="flex flex-col gap-4 py-4">
      {/* Une phrase, pas une rangee de compteurs : ce que l'on vient verifier en
          arrivant, c'est que la surveillance tourne. */}
      <div>
        <h1 className="font-serif text-3xl">
          {allPrivate
            ? 'Surveillance coupée'
            : watched === 0
              ? 'Aucune caméra surveillée'
              : `${watched} caméra${watched > 1 ? 's' : ''} sous surveillance`}
        </h1>
        {data.warnings.length > 0 && (
          <ul className="mt-2 space-y-1">
            {data.warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {warning}
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">En direct</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={allPrivate ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                onPrivacyPendingSet({
                  cameraIds: cameras.map((camera) => camera.id),
                  active: !allPrivate,
                  cameraLabel: null,
                })
              }
            >
              {allPrivate ? 'Reprendre la surveillance' : 'Tout couper'}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/settings/cameras">Gérer les caméras</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cameras.map((camera) => (
            <CameraLiveThumbnail
              key={camera.id}
              camera={camera}
              apiBaseUrl={apiBaseUrl}
              frigateStatus={frigateStatus}
              onExpand={camera.privacyModeActive ? undefined : () => onOpenLive(camera)}
              busy={privacyBusyIds.has(camera.id)}
              onTogglePrivacy={(target, active) =>
                onPrivacyPendingSet({
                  cameraIds: [target.id],
                  active,
                  cameraLabel: target.displayName,
                })
              }
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        <Card>
          <h2 className="font-medium">Dernières détections</h2>

          {data.recentEvents.length > 0 ? (
            <div className="mt-3">
              <DetectionList
                events={data.recentEvents.slice(0, RECENT_EVENTS_MAX)}
                apiBaseUrl={apiBaseUrl}
                onOpenMedia={onOpenMedia}
              />
            </div>
          ) : (
            <p className="mt-3 text-muted-foreground">
              Rien à signaler. Les détections apparaîtront ici.
            </p>
          )}

          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/history">Tout l’historique</Link>
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="font-medium">Alertes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.notifications.activeChannels > 0
                ? `${data.notifications.sentCount} envoyée${data.notifications.sentCount > 1 ? 's' : ''}${
                    data.notifications.lastSentAt
                      ? ` · dernière à ${formatEventTime(data.notifications.lastSentAt)}`
                      : ''
                  }`
                : 'Aucun canal configuré : Vyzio ne peut pas vous prévenir.'}
            </p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link to="/settings/notifications">Configurer les alertes</Link>
              </Button>
            </div>
          </Card>

          {systemStats && <SystemMonitorPanel stats={systemStats} />}
        </div>
      </div>

      {privacyPending && (
        <ConfirmModal
          title={privacyWording(privacyPending).title}
          body={privacyWording(privacyPending).body}
          confirmLabel={privacyWording(privacyPending).confirmLabel}
          tone={privacyPending.active ? 'warn' : 'confirm'}
          loading={privacyLoading}
          onConfirm={() => onTogglePrivacy(privacyPending)}
          onCancel={() => onPrivacyPendingSet(null)}
        />
      )}
    </main>
  )
}
