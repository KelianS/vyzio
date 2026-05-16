import { useEffect, useState } from 'react'
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
} from './app/dependencies'
import { useHubOverview } from './ui/hooks/useHubOverview'
import { useCameras } from './ui/hooks/useCameras'
import {
  formatEventDetail,
  formatEventTime,
  formatLastNotification,
  formatEventTitle,
  formatLastSeen,
  formatNotificationStatus,
  formatProfileMeta,
  getEventTone,
} from './ui/formatters/hub'
import { AppHeader } from './ui/components/AppHeader'
import { CameraLiveThumbnail } from './ui/components/CameraLiveThumbnail'
import { ToastProvider } from './ui/components/Toast'
import { CameraOnboardingView } from './ui/components/CameraOnboardingView'
import { DetectionHistoryView } from './ui/components/DetectionHistoryView'
import { NotificationSettingsView } from './ui/components/NotificationSettingsView'
import { ProfilesView } from './ui/components/ProfilesView'

type AppView = 'hub' | 'cameras' | 'notifications' | 'profiles' | 'history'

function App() {
  const [view, setView] = useState<AppView>(() => getViewFromHash(window.location.hash))
  const { data, loading: hubLoading, error: hubError } = useHubOverview(getHubOverview)
  const { data: cameras, loading: camerasLoading } = useCameras(getCameras)

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
            frigateBaseUrl={dashboardRuntime.frigateBaseUrl}
            apiBaseUrl={dashboardRuntime.apiBaseUrl}
            onBack={navigateBack}
          />
        )}

        {view === 'hub' && (
          <HubView
            hubLoading={hubLoading}
            camerasLoading={camerasLoading}
            hubError={hubError}
            data={data}
            cameras={cameras}
          />
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
  hubError: string | null
  data: HubOverviewData
  cameras: CamerasData
}

function HubView({ hubLoading, camerasLoading, hubError, data, cameras }: HubViewProps) {
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

  return <HubOperationalState data={data} cameras={activeCameras} allCameras={cameras} />
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

function HubDegradedState({ error }: { error: string | null }) {
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
          {error && <p className="hub-degraded-error">{error}</p>}
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
              <p>Détection automatique ou saisie manuelle de votre flux RTSP.</p>
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

interface HubOperationalStateProps {
  data: HubOverview | null
  cameras: Camera[]
  allCameras: Camera[]
}

function HubOperationalState({ data, cameras, allCameras }: HubOperationalStateProps) {
  const recentEvents = data?.recentEvents ?? []
  const recentProfiles = data?.profiles.slice(0, 3) ?? []
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
          <p className="section-kicker">Live</p>
          <h2>Flux en direct</h2>
          <a href="#cameras" className="hub-section-link">
            Gérer les caméras →
          </a>
        </div>
        {cameras.length > 0 ? (
          <div className="hub-live-grid">
            {allCameras.map((camera) => (
              <CameraLiveThumbnail
                key={camera.id}
                camera={camera}
                apiBaseUrl={dashboardRuntime.apiBaseUrl}
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

      <section className="hub-grid">
        <article className="panel panel-secondary" id="events">
          <div className="panel-heading">
            <p className="section-kicker">Événements</p>
            <h2>Détections récentes</h2>
          </div>
          {notifications && (
            <p className="hub-notif-status">{formatNotificationStatus(notifications)}</p>
          )}
          <div className="event-list">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <article key={event.eventId} className={`event-card ${getEventTone(event)}`}>
                  {event.hasSnapshot && (
                    <a
                      className="event-card-thumb"
                      href={`${dashboardRuntime.frigateBaseUrl}/api/events/${event.frigateEventId}/snapshot.jpg`}
                      target="_blank"
                      rel="noreferrer"
                      title="Voir l'aperçu"
                    >
                      <img
                        src={`${dashboardRuntime.frigateBaseUrl}/api/events/${event.frigateEventId}/snapshot.jpg`}
                        alt={formatEventTitle(event)}
                        loading="lazy"
                      />
                    </a>
                  )}
                  <div className="event-card-body">
                    <h3>{formatEventTitle(event)}</h3>
                    <p>{formatEventDetail(event)}</p>
                    <div className="event-card-meta">
                      {event.confidence !== null && (
                        <span className="event-card-confidence">
                          {Math.round(event.confidence * 100)}&nbsp;%
                        </span>
                      )}
                      {event.hasClip && (
                        <a
                          className="event-card-clip"
                          href={`${dashboardRuntime.apiBaseUrl}/api/detection-events/${event.eventId}/clip`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          ▶ Clip
                        </a>
                      )}
                    </div>
                  </div>
                  <span className="event-card-time">{formatEventTime(event.occurredAt)}</span>
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

        <article className="panel panel-dark" id="profiles">
          <div className="panel-heading">
            <p className="section-kicker">Profils</p>
            <h2>Personnes reconnues</h2>
          </div>
          <div className="profile-list">
            {recentProfiles.length > 0 ? (
              recentProfiles.map((profile) => (
                <article key={profile.id} className="profile-card">
                  <div>
                    <h3>{profile.name}</h3>
                    <p>{formatProfileMeta(profile)}</p>
                  </div>
                  <span>{formatLastSeen(profile.lastSeenAt)}</span>
                </article>
              ))
            ) : (
              <article className="profile-card empty">
                <div>
                  <h3>Aucun profil configuré</h3>
                  <p>Ajoutez des profils pour reconnaître les personnes dans vos flux.</p>
                </div>
              </article>
            )}
          </div>
          <div className="panel-cta-row">
            <a className="primary-cta hub-cta-inverse" href="#profiles">
              Gérer les profils
            </a>
          </div>
        </article>

        <article className="panel panel-expert" id="expert">
          <div className="panel-heading">
            <p className="section-kicker">Mode avancé</p>
            <h2>Interface experte</h2>
          </div>
          <p className="expert-copy">
            Accès aux réglages fins de Frigate pour les utilisateurs techniques.
          </p>
          <a
            className="expert-link"
            href={dashboardRuntime.frigateBaseUrl}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir Frigate
          </a>
          <p className="expert-footnote">
            {notifications
              ? formatLastNotification(notifications.lastSentAt)
              : 'Aucune information disponible'}
          </p>
        </article>
      </section>
    </main>
  )
}

function getViewFromHash(hash: string): AppView {
  if (hash === '#cameras') return 'cameras'
  if (hash === '#notifications') return 'notifications'
  if (hash === '#profiles') return 'profiles'
  if (hash === '#history') return 'history'
  return 'hub'
}

export default App
