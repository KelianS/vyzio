import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Play, TriangleAlert } from 'lucide-react'
import { appErrorMessage, type AppError } from '../../common/errors/AppError'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { Overlay } from '../../common/components/Overlay'
import { CameraLiveThumbnail } from '../../common/components/CameraLiveThumbnail'
import { LiveFeedModal } from '../../common/components/LiveFeedModal'
import { usePresenter } from '../../common/presenter/usePresenter'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { Camera } from '../../domain/entities/Camera'
import type { HubOverview } from '../../domain/entities/HubOverview'
import type { SystemStats } from '../../domain/entities/SystemStats'
import { formatEventDetail, formatEventTime, formatEventTitle } from './hub.formatters'
import { SystemMonitorPanel } from './SystemMonitorPanel'
import { buildHubPresenter } from './Hub.Presenter'
import { hubReducer } from './Hub.Reducer'
import { buildInitialHubUido } from './Hub.Uido'

type ModalMedia =
  | { type: 'image' | 'video'; url: string }
  | { type: 'live'; cameraId: string; label: string; ptzSupported: boolean }

export function HubView() {
  const { apiBaseUrl, hub: container, cameras: camerasContainer } = useAppContainer()
  const [uido, dispatch] = useReducer(hubReducer, undefined, buildInitialHubUido)
  const presenter = usePresenter(buildHubPresenter, { container, camerasContainer, dispatch })

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
        batchPending={uido.batchPending}
        batchToggleLoading={uido.batchToggleLoading}
        onBatchPendingSet={presenter.onBatchPendingSet}
        onOpenMedia={(type, url) => setModalMedia({ type, url })}
        onOpenLive={(camera) =>
          setModalMedia({
            type: 'live',
            cameraId: camera.id,
            label: camera.displayName,
            ptzSupported: camera.ptzSupported,
          })
        }
        onTogglePrivacy={(camera, active) => presenter.onTogglePrivacy(camera.id, active)}
        onBatchTogglePrivacy={presenter.onBatchTogglePrivacy}
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
              capturePtzPresetThumbnail={camerasContainer.capturePtzPresetThumbnail}
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

/** Vyzio ne repond pas : on nomme la panne, et ce qu'il y a a verifier. */
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
  batchPending: boolean | null
  batchToggleLoading: boolean
  onBatchPendingSet: (value: boolean | null) => void
  onOpenMedia: (type: 'image' | 'video', url: string) => void
  onOpenLive: (camera: Camera) => void
  onTogglePrivacy: (camera: Camera, active: boolean) => void
  onBatchTogglePrivacy: (cameraIds: string[], active: boolean) => void
}

function HubOperational({
  data,
  cameras,
  apiBaseUrl,
  systemStats,
  batchPending,
  batchToggleLoading,
  onBatchPendingSet,
  onOpenMedia,
  onOpenLive,
  onTogglePrivacy,
  onBatchTogglePrivacy,
}: HubOperationalProps) {
  const frigateStatus = systemStats?.status ?? 'active'
  const allPrivate = cameras.every((camera) => camera.privacyModeActive)
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
              onClick={() => onBatchPendingSet(!allPrivate)}
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
              onTogglePrivacy={onTogglePrivacy}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        <Card>
          <h2 className="font-medium">Dernières détections</h2>

          {data.recentEvents.length > 0 ? (
            <ul className="mt-3 divide-y divide-border">
              {data.recentEvents.map((event) => (
                <li
                  key={event.eventId}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  {event.hasSnapshot && (
                    <button
                      type="button"
                      aria-label={`Voir l’aperçu — ${formatEventTitle(event)}`}
                      className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={() =>
                        onOpenMedia(
                          'image',
                          `${apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`,
                        )
                      }
                    >
                      <img
                        src={`${apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`}
                        alt=""
                        loading="lazy"
                        className="size-14 rounded-lg object-cover"
                      />
                    </button>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{formatEventTitle(event)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {formatEventDetail(event)} · {formatEventTime(event.occurredAt)}
                    </span>
                  </span>

                  {event.hasClip && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onOpenMedia(
                          'video',
                          `${apiBaseUrl}/api/detection-events/${event.eventId}/clip`,
                        )
                      }
                    >
                      <Play aria-hidden="true" />
                      Vidéo
                    </Button>
                  )}
                </li>
              ))}
            </ul>
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
              {data.notifications.telegramConfigured
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

      {batchPending !== null && (
        <ConfirmModal
          title={batchPending ? 'Couper toutes les caméras ?' : 'Reprendre la surveillance ?'}
          body={
            batchPending
              ? 'Plus rien n’est enregistré ni signalé tant que vous ne les rallumez pas.'
              : 'Les caméras recommencent à enregistrer et à vous signaler ce qu’elles voient.'
          }
          confirmLabel={batchPending ? 'Tout couper' : 'Reprendre'}
          tone={batchPending ? 'warn' : 'confirm'}
          loading={batchToggleLoading}
          onConfirm={() =>
            onBatchTogglePrivacy(
              cameras.map((camera) => camera.id),
              batchPending,
            )
          }
          onCancel={() => onBatchPendingSet(null)}
        />
      )}
    </main>
  )
}
