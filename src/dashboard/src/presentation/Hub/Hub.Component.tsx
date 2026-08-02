import { useEffect, useReducer, useState } from 'react'
import { appErrorMessage } from '../../common/errors/AppError'
import type { AppError } from '../../common/errors/AppError'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { CameraLiveThumbnail } from '../../common/components/CameraLiveThumbnail'
import { LiveFeedModal } from '../../common/components/LiveFeedModal'
import { usePresenter } from '../../common/presenter/usePresenter'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { Camera } from '../../domain/entities/Camera'
import type { HubOverview } from '../../domain/entities/HubOverview'
import type { SystemStats } from '../../domain/entities/SystemStats'
import {
  formatEventDetail,
  formatEventTime,
  formatEventTitle,
  getEventTone,
} from './hub.formatters'
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

  const isLoading = uido.loading || camerasLoading

  if (isLoading) {
    return <HubLoadingState />
  }

  if (uido.error || (!uido.loading && !uido.data?.systemHealthy)) {
    return <HubDegradedState error={uido.error} />
  }

  const activeCameras = cameras.filter((c) => c.isEnabled)

  if (cameras.length === 0) {
    return <HubSetupState />
  }

  return (
    <>
      <HubOperationalState
        data={uido.data}
        cameras={activeCameras}
        allCameras={cameras}
        apiBaseUrl={apiBaseUrl}
        systemStats={systemStats}
        batchPending={uido.batchPending}
        batchToggleLoading={uido.batchToggleLoading}
        onBatchPendingSet={(value) => presenter.onBatchPendingSet(value)}
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
        onBatchTogglePrivacy={(cameraIds, active) =>
          presenter.onBatchTogglePrivacy(cameraIds, active)
        }
      />

      {modalMedia && (
        <div onClick={() => setModalMedia(null)} className="media-modal-backdrop">
          <div onClick={(e) => e.stopPropagation()} className="media-modal-content">
            <button type="button" onClick={() => setModalMedia(null)} className="media-modal-close">
              ✕
            </button>
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
              <img src={modalMedia.url} alt="Aperçu détection" className="media-modal-media" />
            ) : (
              <video src={modalMedia.url} controls autoPlay className="media-modal-media" />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function HubLoadingState() {
  return (
    <main className="app-shell hub-loading">
      <div className="hub-skeleton hub-skeleton--hero" aria-label="Chargement..." />
      <div className="hub-skeleton-row">
        <div className="hub-skeleton hub-skeleton--card" />
        <div className="hub-skeleton hub-skeleton--card" />
        <div className="hub-skeleton hub-skeleton--card" />
      </div>
    </main>
  )
}

function HubDegradedState({ error }: { error: AppError | null }) {
  return (
    <main className="app-shell">
      <section className="hub-degraded-panel panel">
        <div className="hub-degraded-icon" aria-hidden="true">
          ⚠
        </div>
        <div>
          <p className="eyebrow">Système indisponible</p>
          <h1>Vyzio ne répond pas</h1>
          <p className="lede">Le hub ne peut pas joindre le service Vyzio pour le moment.</p>
        </div>
        <div className="hub-degraded-steps">
          <p>Vérifiez que :</p>
          <ol>
            <li>Le service Vyzio API est bien démarré</li>
            <li>Le conteneur Docker est en cours d'exécution</li>
            <li>L'adresse du backend est correcte dans la configuration</li>
          </ol>
          {error && <p className="hub-degraded-error">{appErrorMessage(error)}</p>}
        </div>
      </section>
    </main>
  )
}

function HubSetupState() {
  return (
    <main className="app-shell">
      <section className="hub-setup-hero panel">
        <div className="hub-setup-copy">
          <p className="eyebrow">Bienvenue sur Vyzio</p>
          <h1>Configurer votre première caméra</h1>
          <p className="lede">
            Connectez vos caméras IP existantes en quelques étapes pour démarrer la surveillance.
          </p>
        </div>
        <div className="hub-setup-steps">
          <div className="hub-setup-step">
            <div className="hub-setup-step-num">1</div>
            <div>
              <strong>Ajouter une caméra</strong>
              <p>Détection automatique ou saisie manuelle de votre caméra.</p>
            </div>
          </div>
          <div className="hub-setup-step">
            <div className="hub-setup-step-num">2</div>
            <div>
              <strong>Configurer la détection</strong>
              <p>Choisissez ce que Vyzio doit surveiller : personnes, animaux, véhicules.</p>
            </div>
          </div>
          <div className="hub-setup-step">
            <div className="hub-setup-step-num">3</div>
            <div>
              <strong>Activer les alertes</strong>
              <p>Recevez vos premières notifications sur Telegram.</p>
            </div>
          </div>
        </div>
        <div className="panel-cta-row">
          <a className="primary-cta" href="/settings/cameras">
            Ajouter une caméra
          </a>
          <a className="secondary-cta" href="/settings/notifications">
            Configurer les alertes
          </a>
        </div>
      </section>
    </main>
  )
}

interface HubOperationalStateProps {
  data: HubOverview | null
  cameras: Camera[]
  allCameras: Camera[]
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

function HubOperationalState({
  data,
  cameras,
  allCameras,
  apiBaseUrl,
  systemStats,
  batchPending,
  batchToggleLoading,
  onBatchPendingSet,
  onOpenMedia,
  onOpenLive,
  onTogglePrivacy,
  onBatchTogglePrivacy,
}: HubOperationalStateProps) {
  const frigateStatus = systemStats?.status ?? 'active'

  const recentEvents = data?.recentEvents ?? []
  const notifications = data?.notifications
  const warnings = data?.warnings ?? []
  const lastEvent = recentEvents[0]

  const cameraCount = allCameras.length
  const activeCameraCount = cameras.length
  const profileCount = data?.profiles.length ?? 0

  return (
    <main className="app-shell">
      <section className="hub-status-bar">
        <div className="hub-status-facts">
          <div className="hub-status-fact">
            <strong>
              {activeCameraCount}/{cameraCount}
            </strong>
            <span>caméras actives</span>
          </div>
          <div className="hub-status-fact">
            <strong>{profileCount}</strong>
            <span>profils</span>
          </div>
          <div className="hub-status-fact">
            <strong>{notifications?.sentCount ?? 0}</strong>
            <span>alertes envoyées</span>
          </div>
          {lastEvent && (
            <div className="hub-status-fact">
              <strong>{formatEventTime(lastEvent.occurredAt)}</strong>
              <span>dernier événement</span>
            </div>
          )}
        </div>
        {warnings.length > 0 && (
          <div className="hub-status-warnings">
            {warnings.map((w) => (
              <p key={w} className="hub-status-warning">
                {w}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="hub-live-section">
        <div className="hub-section-header">
          <h2>Flux en direct</h2>
          <div className="hub-section-actions">
            {allCameras.length > 0 && (
              <button
                type="button"
                className={`hub-privacy-global-btn${allCameras.every((c) => c.privacyModeActive) ? ' hub-privacy-global-btn--active' : ''}`}
                onClick={() => onBatchPendingSet(!allCameras.every((c) => c.privacyModeActive))}
              >
                {allCameras.every((c) => c.privacyModeActive)
                  ? 'Désactiver le mode vie privée'
                  : 'Mode vie privée global'}
              </button>
            )}
            <a href="/settings/cameras" className="hub-section-link">
              Gérer les caméras →
            </a>
          </div>
        </div>
        {cameras.length > 0 || allCameras.some((c) => c.privacyModeActive) ? (
          <div className="hub-live-grid">
            {allCameras.map((camera) => (
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
        ) : (
          <div className="hub-live-empty">
            <p>Aucune caméra active pour le moment.</p>
            <a href="/settings/cameras" className="secondary-cta">
              Gérer les caméras
            </a>
          </div>
        )}
      </section>

      <section className="hub-bottom">
        <article className="panel hub-events" id="events">
          <div className="panel-heading">
            <h2>Détections récentes</h2>
          </div>
          <div className="event-list">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <article key={event.eventId} className={`event-card ${getEventTone(event)}`}>
                  {event.hasSnapshot && (
                    <button
                      type="button"
                      className="event-card-thumb"
                      onClick={() =>
                        onOpenMedia(
                          'image',
                          `${apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`,
                        )
                      }
                      title="Voir l'aperçu"
                    >
                      <img
                        src={`${apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`}
                        alt={formatEventTitle(event)}
                        loading="lazy"
                      />
                      {frigateStatus === 'restarting' && (
                        <span className="media-loading-overlay" aria-hidden="true">
                          <span className="media-loading-spinner" />
                        </span>
                      )}
                    </button>
                  )}
                  <div className="event-card-body">
                    <h3>{formatEventTitle(event)}</h3>
                    <div className="event-card-meta">
                      {event.confidence !== null && (
                        <span className="event-card-confidence">
                          {Math.round(event.confidence * 100)}&nbsp;%
                        </span>
                      )}
                      {event.hasClip && (
                        <button
                          type="button"
                          className="event-card-clip"
                          onClick={() =>
                            onOpenMedia(
                              'video',
                              `${apiBaseUrl}/api/detection-events/${event.eventId}/clip`,
                            )
                          }
                        >
                          ▶ Clip
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="event-card-aside">
                    <span className="event-card-time">{formatEventTime(event.occurredAt)}</span>
                    <span className="event-card-camera">{formatEventDetail(event)}</span>
                  </div>
                </article>
              ))
            ) : (
              <article className="event-card empty">
                <div>
                  <h3>Aucune détection récente</h3>
                  <p>Les événements apparaîtront ici dès que la surveillance sera active.</p>
                </div>
              </article>
            )}
          </div>
          <div className="panel-cta-row">
            <a className="primary-cta" href="/history">
              Tout l'historique
            </a>
          </div>
        </article>

        <aside className="hub-sidebar">
          <article className="panel hub-alert-status">
            <div className="panel-heading">
              <h2>Notifications</h2>
            </div>
            <div className="hub-alert-items">
              <div
                className={`hub-alert-item${notifications?.telegramConfigured ? ' hub-alert-item--ok' : ' hub-alert-item--warn'}`}
              >
                <span className="hub-alert-dot" />
                <div className="hub-alert-body">
                  <strong>
                    {notifications?.telegramConfigured
                      ? 'Telegram configuré'
                      : 'Telegram non configuré'}
                  </strong>
                  <p>
                    {notifications?.telegramConfigured
                      ? `${notifications.sentCount} alerte${notifications.sentCount !== 1 ? 's' : ''} envoyée${notifications.sentCount !== 1 ? 's' : ''}${notifications?.lastSentAt ? ` · dernière à ${formatEventTime(notifications.lastSentAt)}` : ''}`
                      : 'Aucun canal de notification actif'}
                  </p>
                </div>
              </div>
            </div>
            <div className="panel-cta-row">
              <a href="/settings/notifications" className="secondary-cta">
                Configurer les alertes →
              </a>
            </div>
          </article>

          {systemStats && <SystemMonitorPanel stats={systemStats} />}
        </aside>
      </section>

      {batchPending !== null && (
        <ConfirmModal
          title={batchPending ? 'Activer le mode vie privée' : 'Désactiver le mode vie privée'}
          body={
            batchPending
              ? `Vyzio va arrêter l'enregistrement sur ${allCameras.length > 1 ? `les ${allCameras.length} caméras` : 'la caméra'}. Aucune alerte ne sera générée pendant cette période.`
              : `Vyzio va reprendre la surveillance sur ${allCameras.length > 1 ? `les ${allCameras.length} caméras` : 'la caméra'}.`
          }
          confirmLabel={batchPending ? 'Couper toutes les caméras' : 'Réactiver toutes les caméras'}
          tone={batchPending ? 'warn' : 'default'}
          loading={batchToggleLoading}
          onConfirm={() => {
            onBatchTogglePrivacy(
              allCameras.map((c) => c.id),
              batchPending,
            )
          }}
          onCancel={() => onBatchPendingSet(null)}
        />
      )}
    </main>
  )
}
