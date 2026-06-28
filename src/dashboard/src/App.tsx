import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  addProfilePhoto,
  applyCameraConfiguration,
  correctDetectionIdentity,
  createCamera,
  createProfile,
  dashboardRuntime,
  deleteCamera,
  deleteNotificationChannel,
  deleteProfile,
  discoverCameras,
  getCameraStatus,
  getCameras,
  getCameraDetectionConfig,
  getDetectionHistory,
  getCameraLabels,
  getNotificationLabels,
  getHubOverview,
  getNotificationChannelConfig,
  getNotificationLog,
  getProfileCameraLinks,
  getProfilePhotos,
  getProfiles,
  getSystemStats,
  getVendorAssistance,
  removeProfilePhoto,
  resyncFaceLibrary,
  saveNotificationChannelConfig,
  saveCameraDetectionConfig,
  setProfileCameraLinks,
  testNotificationChannel,
  updateCamera,
  updateProfile,
  verifyCamera,
  verifyDraftCamera,
  toggleCameraPrivacyMode,
  batchToggleCameraPrivacyMode,
  getCameraPrivacySchedules,
  createCameraPrivacySchedule,
  deleteCameraPrivacySchedule,
  setPrivacyStrategy,
  ptzStep,
  ptzGoToPreset,
  configurePtzParking,
} from './app/dependencies'
import { useHubOverview } from './ui/hooks/useHubOverview'
import { useCameras } from './ui/hooks/useCameras'
import {
  formatEventDetail,
  formatEventTime,
  formatEventTitle,
  getEventTone,
} from './ui/formatters/hub'
import { AppHeader } from './ui/components/AppHeader'
import { CameraLiveThumbnail } from './ui/components/CameraLiveThumbnail'
import { ToastProvider } from './ui/components/Toast'
import type { AppError } from './domain/errors/AppError'
import { appErrorMessage } from './domain/errors/AppError'
import { CameraOnboardingView } from './ui/components/CameraOnboardingView'
import { PtzControlPanel } from './ui/components/PtzControlPanel'
import { DetectionHistoryView } from './ui/components/DetectionHistoryView'
import { ExpertView } from './ui/components/ExpertView'
import { NotificationSettingsView } from './ui/components/NotificationSettingsView'
import { ProfilesView } from './ui/components/ProfilesView'

type AppView = 'hub' | 'cameras' | 'notifications' | 'profiles' | 'history' | 'expert'

function App() {
  const [view, setView] = useState<AppView>(() => getViewFromHash(window.location.hash))
  const { data, loading: hubLoading, error: hubError } = useHubOverview(getHubOverview)
  const { data: cameras, loading: camerasLoading, reload: reloadCameras } = useCameras(getCameras)
  const [modalMedia, setModalMedia] = useState<
    | { type: 'image' | 'video'; url: string }
    | { type: 'live'; cameraId: string; apiBaseUrl: string; label: string; ptzSupported: boolean }
    | null
  >(null)

  useEffect(() => {
    const handleHashChange = () => {
      setView(getViewFromHash(window.location.hash))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigateBack = () => {
    window.location.hash = ''
    setView('hub')
  }

  return (
    <ToastProvider>
      <div className="layout-root">
        <AppHeader currentView={view} />

        {view === 'cameras' && (
          <CameraOnboardingView
            getCameras={getCameras}
            getCameraStatus={getCameraStatus}
            discoverCameras={discoverCameras}
            getVendorAssistance={getVendorAssistance}
            createCamera={createCamera}
            updateCamera={updateCamera}
            verifyDraftCamera={verifyDraftCamera}
            verifyCamera={verifyCamera}
            applyCameraConfiguration={applyCameraConfiguration}
            deleteCamera={deleteCamera}
            getCameraDetectionConfig={getCameraDetectionConfig}
            saveCameraDetectionConfig={saveCameraDetectionConfig}
            getCameraLabels={getCameraLabels}
            getPrivacySchedules={getCameraPrivacySchedules}
            createPrivacySchedule={createCameraPrivacySchedule}
            deletePrivacySchedule={deleteCameraPrivacySchedule}
            setPrivacyStrategy={setPrivacyStrategy}
            ptzStep={ptzStep}
            ptzGoToPreset={ptzGoToPreset}
            configurePtzParking={configurePtzParking}
            allCameras={cameras}
            apiBaseUrl={dashboardRuntime.apiBaseUrl}
          />
        )}

        {view === 'notifications' && (
          <NotificationSettingsView
            getNotificationChannelConfig={getNotificationChannelConfig}
            saveNotificationChannelConfig={saveNotificationChannelConfig}
            testNotificationChannel={testNotificationChannel}
            deleteNotificationChannel={deleteNotificationChannel}
            getNotificationLog={getNotificationLog}
            getNotificationLabels={getNotificationLabels}
            onBack={navigateBack}
          />
        )}

        {view === 'profiles' && (
          <ProfilesView
            getProfiles={getProfiles}
            createProfile={createProfile}
            updateProfile={updateProfile}
            deleteProfile={deleteProfile}
            getProfilePhotos={getProfilePhotos}
            addProfilePhoto={addProfilePhoto}
            removeProfilePhoto={removeProfilePhoto}
            getProfileCameraLinks={getProfileCameraLinks}
            setProfileCameraLinks={setProfileCameraLinks}
            resyncFaceLibrary={resyncFaceLibrary}
            apiBaseUrl={dashboardRuntime.apiBaseUrl}
            onBack={navigateBack}
          />
        )}

        {view === 'history' && (
          <DetectionHistoryView
            getDetectionHistory={getDetectionHistory}
            getCameraLabels={getCameraLabels}
            correctDetectionIdentity={correctDetectionIdentity}
            getProfiles={getProfiles}
            apiBaseUrl={dashboardRuntime.apiBaseUrl}
            onBack={navigateBack}
          />
        )}

        {view === 'expert' && (
          <ExpertView frigateBaseUrl={dashboardRuntime.frigateBaseUrl} />
        )}

        {view === 'hub' && (
          <HubView
            hubLoading={hubLoading}
            camerasLoading={camerasLoading}
            hubError={hubError}
            data={data}
            cameras={cameras}
            getSystemStats={getSystemStats}
            onOpenMedia={(type, url) => setModalMedia({ type, url })}
            onOpenLive={(camera) => setModalMedia({ type: 'live', cameraId: camera.id, apiBaseUrl: dashboardRuntime.apiBaseUrl, label: camera.displayName, ptzSupported: camera.ptzSupported })}
            onTogglePrivacy={async (camera, active) => {
              await toggleCameraPrivacyMode.execute(camera.id, active)
              reloadCameras()
            }}
            onBatchTogglePrivacy={async (cameraIds, active) => {
              await batchToggleCameraPrivacyMode.execute(cameraIds, active)
              reloadCameras()
            }}
          />
        )}

        {modalMedia && (
          <div
            onClick={() => setModalMedia(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setModalMedia(null)}
                style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
              {modalMedia.type === 'live' ? (
                <LiveFeedModal cameraId={modalMedia.cameraId} apiBaseUrl={modalMedia.apiBaseUrl} label={modalMedia.label} ptzSupported={modalMedia.ptzSupported} />
              ) : modalMedia.type === 'image' ? (
                <img src={modalMedia.url} alt="Aperçu détection" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, display: 'block' }} />
              ) : (
                <video src={modalMedia.url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, display: 'block' }} />
              )}
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}

type HubOverviewData = ReturnType<typeof useHubOverview>['data']
type CamerasData = ReturnType<typeof useCameras>['data']

interface HubViewProps {
  hubLoading: boolean
  camerasLoading: boolean
  hubError: AppError | null
  data: HubOverviewData
  cameras: CamerasData
  getSystemStats: GetSystemStats
  onOpenMedia: (type: 'image' | 'video', url: string) => void
  onOpenLive: (camera: Camera) => void
  onTogglePrivacy: (camera: Camera, active: boolean) => Promise<void>
  onBatchTogglePrivacy: (cameraIds: string[], active: boolean) => Promise<void>
}

function HubView({ hubLoading, camerasLoading, hubError, data, cameras, getSystemStats, onOpenMedia, onOpenLive, onTogglePrivacy, onBatchTogglePrivacy }: HubViewProps) {
  const isLoading = hubLoading || camerasLoading

  if (isLoading) {
    return <HubLoadingState />
  }

  if (hubError || (!hubLoading && !data?.systemHealthy)) {
    return <HubDegradedState error={hubError} />
  }

  const activeCameras = cameras.filter((c) => c.isEnabled)

  if (cameras.length === 0) {
    return <HubSetupState />
  }

  return <HubOperationalState data={data} cameras={activeCameras} allCameras={cameras} getSystemStats={getSystemStats} onOpenMedia={onOpenMedia} onOpenLive={onOpenLive} onTogglePrivacy={onTogglePrivacy} onBatchTogglePrivacy={onBatchTogglePrivacy} />
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
        <div className="hub-degraded-icon" aria-hidden="true">⚠</div>
        <div>
          <p className="eyebrow">Système indisponible</p>
          <h1>Vyzio ne répond pas</h1>
          <p className="lede">
            Le hub ne peut pas joindre le service Vyzio pour le moment.
          </p>
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
          <a className="primary-cta" href="#cameras">
            Ajouter une caméra
          </a>
          <a className="secondary-cta" href="#notifications">
            Configurer les alertes
          </a>
        </div>
      </section>
    </main>
  )
}

import type { Camera } from './domain/entities/Camera'
import type { HubOverview } from './domain/entities/HubOverview'
import type { GetSystemStats } from './application/use-cases/GetSystemStats'
import type { SystemStats } from './domain/entities/SystemStats'
import { SystemMonitorPanel } from './ui/components/SystemMonitorPanel'

interface HubOperationalStateProps {
  data: HubOverview | null
  cameras: Camera[]
  allCameras: Camera[]
  getSystemStats: GetSystemStats
  onOpenMedia: (type: 'image' | 'video', url: string) => void
  onOpenLive: (camera: Camera) => void
  onTogglePrivacy: (camera: Camera, active: boolean) => Promise<void>
  onBatchTogglePrivacy: (cameraIds: string[], active: boolean) => Promise<void>
}

function HubOperationalState({ data, cameras, allCameras, getSystemStats, onOpenMedia, onOpenLive, onTogglePrivacy, onBatchTogglePrivacy }: HubOperationalStateProps) {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [batchPending, setBatchPending] = useState<boolean | null>(null)

  useEffect(() => {
    getSystemStats.execute().then(setSystemStats).catch(() => {})
  }, [getSystemStats])

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
            <strong>{activeCameraCount}/{cameraCount}</strong>
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
                onClick={() => setBatchPending(!allCameras.every((c) => c.privacyModeActive))}
              >
                {allCameras.every((c) => c.privacyModeActive)
                  ? 'Désactiver le mode vie privée'
                  : 'Mode vie privée global'}
              </button>
            )}
            <a href="#cameras" className="hub-section-link">
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
                apiBaseUrl={dashboardRuntime.apiBaseUrl}
                onExpand={camera.privacyModeActive ? undefined : () => onOpenLive(camera)}
                onTogglePrivacy={onTogglePrivacy}
              />
            ))}
          </div>
        ) : (
          <div className="hub-live-empty">
            <p>Aucune caméra active pour le moment.</p>
            <a href="#cameras" className="secondary-cta">
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
                      onClick={() => onOpenMedia('image', `${dashboardRuntime.apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`)}
                      title="Voir l'aperçu"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      <img
                        src={`${dashboardRuntime.apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`}
                        alt={formatEventTitle(event)}
                        loading="lazy"
                      />
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
                          onClick={() => onOpenMedia('video', `${dashboardRuntime.apiBaseUrl}/api/detection-events/${event.eventId}/clip`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
            <a className="primary-cta" href="#history">
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
              <div className={`hub-alert-item${notifications?.telegramConfigured ? ' hub-alert-item--ok' : ' hub-alert-item--warn'}`}>
                <span className="hub-alert-dot" />
                <div className="hub-alert-body">
                  <strong>{notifications?.telegramConfigured ? 'Telegram configuré' : 'Telegram non configuré'}</strong>
                  <p>
                    {notifications?.telegramConfigured
                      ? `${notifications.sentCount} alerte${notifications.sentCount !== 1 ? 's' : ''} envoyée${notifications.sentCount !== 1 ? 's' : ''}${notifications?.lastSentAt ? ` · dernière à ${formatEventTime(notifications.lastSentAt)}` : ''}`
                      : 'Aucun canal de notification actif'}
                  </p>
                </div>
              </div>
            </div>
            <div className="panel-cta-row">
              <a href="#notifications" className="secondary-cta">
                Configurer les alertes →
              </a>
            </div>
          </article>

          {systemStats && <SystemMonitorPanel stats={systemStats} />}
        </aside>
      </section>

      {batchPending !== null && (
        <PrivacyConfirmModal
          active={batchPending}
          cameraCount={allCameras.length}
          onConfirm={async () => {
            await onBatchTogglePrivacy(allCameras.map((c) => c.id), batchPending)
            setBatchPending(null)
          }}
          onCancel={() => setBatchPending(null)}
        />
      )}
    </main>
  )
}

function PrivacyConfirmModal({
  active,
  cameraCount,
  onConfirm,
  onCancel,
}: {
  active: boolean
  cameraCount: number
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false) }
  }

  return (
    <div className="privacy-modal-backdrop" onClick={onCancel}>
      <div className="privacy-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="privacy-modal-icon" aria-hidden="true">
          {active ? '🔇' : '🔒'}
        </div>
        <h2 className="privacy-modal-title">
          {active ? 'Activer le mode vie privée' : 'Désactiver le mode vie privée'}
        </h2>
        <p className="privacy-modal-body">
          {active
            ? `Vyzio va arrêter l'enregistrement sur ${cameraCount > 1 ? `les ${cameraCount} caméras` : 'la caméra'}. Aucune alerte ne sera générée pendant cette période.`
            : `Vyzio va reprendre la surveillance sur ${cameraCount > 1 ? `les ${cameraCount} caméras` : 'la caméra'}.`}
        </p>
        <div className="privacy-modal-actions">
          <button
            type="button"
            className={`privacy-modal-confirm${active ? ' privacy-modal-confirm--warn' : ''}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Traitement…' : active ? 'Couper toutes les caméras' : 'Réactiver toutes les caméras'}
          </button>
          <button type="button" className="privacy-modal-cancel" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

function LiveFeedModal({ cameraId, apiBaseUrl, label, ptzSupported }: { cameraId: string; apiBaseUrl: string; label: string; ptzSupported: boolean }) {
  const [src, setSrc] = useState(() => `${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSrc(`${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`)
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [cameraId, apiBaseUrl])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img src={src} alt={label} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, display: 'block' }} />
      {ptzSupported && (
        <div className="live-feed-ptz-overlay">
          <PtzControlPanel
            cameraId={cameraId}
            ptzStep={ptzStep}
            ptzGoToPreset={ptzGoToPreset}
            compact
          />
        </div>
      )}
    </div>
  )
}

function getViewFromHash(hash: string): AppView {
  if (hash === '#cameras') return 'cameras'
  if (hash === '#notifications') return 'notifications'
  if (hash === '#profiles') return 'profiles'
  if (hash === '#history') return 'history'
  if (hash === '#expert') return 'expert'
  return 'hub'
}

export default App
