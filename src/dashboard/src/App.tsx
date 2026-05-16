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
import { CameraOnboardingView } from './ui/components/CameraOnboardingView'
import { DetectionHistoryView } from './ui/components/DetectionHistoryView'
import { NotificationSettingsView } from './ui/components/NotificationSettingsView'
import { ProfilesView } from './ui/components/ProfilesView'

type AppView = 'hub' | 'cameras' | 'notifications' | 'profiles' | 'history'

interface SystemStatusViewModel {
  pillTone: 'online' | 'warning' | 'degraded' | 'loading'
  pillLabel: string
  headline: string
  detail: string
}

function getSystemStatusViewModel(
  loading: boolean,
  error: string | null,
  systemHealthy: boolean,
  warnings: string[],
): SystemStatusViewModel {
  if (loading) {
    return {
      pillTone: 'loading',
      pillLabel: 'Connexion en cours',
      headline: 'Le hub contacte votre systeme.',
      detail: 'Les informations vont apparaitre automatiquement.',
    }
  }

  if (error || !systemHealthy) {
    return {
      pillTone: 'degraded',
      pillLabel: 'Systeme indisponible',
      headline: 'Le hub ne recoit pas les informations du systeme.',
      detail: 'Verifiez que le service Vyzio API est bien demarre.',
    }
  }

  if (warnings.length > 0) {
    return {
      pillTone: 'warning',
      pillLabel: 'Attention',
      headline: 'Le systeme fonctionne, mais certaines donnees manquent encore.',
      detail: warnings[0],
    }
  }

  return {
    pillTone: 'online',
    pillLabel: 'Surveillance active',
    headline: 'Le systeme fonctionne normalement.',
    detail: 'Les evenements et profils recents sont disponibles dans le hub.',
  }
}

function App() {
  const [view, setView] = useState<AppView>(() => getViewFromHash(window.location.hash))
  const { data, loading, error } = useHubOverview(getHubOverview)
  const recentEvents = data?.recentEvents ?? []
  const recentProfiles = data?.profiles.slice(0, 3) ?? []
  const lastEvent = recentEvents[0]
  const warnings = data?.warnings ?? []
  const notifications = data?.notifications
  const systemStatus = getSystemStatusViewModel(
    loading,
    error,
    data?.systemHealthy ?? false,
    warnings,
  )

  useEffect(() => {
    const handleHashChange = () => {
      setView(getViewFromHash(window.location.hash))
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  if (view === 'cameras') {
    return (
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
    )
  }

  if (view === 'notifications') {
    return (
      <NotificationSettingsView
        getNotificationChannelConfig={getNotificationChannelConfig}
        saveNotificationChannelConfig={saveNotificationChannelConfig}
        testNotificationChannel={testNotificationChannel}
        deleteNotificationChannel={deleteNotificationChannel}
        getNotificationLog={getNotificationLog}
        getNotificationLabels={getNotificationLabels}
        onBack={() => {
          window.location.hash = ''
          setView('hub')
        }}
      />
    )
  }

  if (view === 'profiles') {
    return (
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
        onBack={() => {
          window.location.hash = ''
          setView('hub')
        }}
      />
    )
  }

  if (view === 'history') {
    return (
      <DetectionHistoryView
        getDetectionHistory={getDetectionHistory}
        getCameraLabels={getCameraLabels}
        correctDetectionIdentity={correctDetectionIdentity}
        getProfiles={getProfiles}
        frigateBaseUrl={dashboardRuntime.frigateBaseUrl}
        apiBaseUrl={dashboardRuntime.apiBaseUrl}
        onBack={() => {
          window.location.hash = ''
          setView('hub')
        }}
      />
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Hub Vyzio</p>
          <h1>Etat, evenements, profils.</h1>
          <p className="lede">Le strict utile, sans couche technique visible.</p>
        </div>

        <div className="hero-status" aria-label="Etat general du systeme">
          <div className={`status-pill ${systemStatus.pillTone}`}>{systemStatus.pillLabel}</div>
          <div className="status-summary">
            <strong>{systemStatus.headline}</strong>
            <p>{systemStatus.detail}</p>
          </div>
          <dl className="status-facts">
            <div>
              <dt>Etat du service</dt>
              <dd>{data?.systemHealthy ? 'Connecte' : 'Non disponible'}</dd>
            </div>
            <div>
              <dt>Dernier evenement</dt>
              <dd>{lastEvent ? formatEventTime(lastEvent.occurredAt) : 'Aucune donnee'}</dd>
            </div>
            <div>
              <dt>Profils visibles</dt>
              <dd>{data?.profiles.length ?? 0}</dd>
            </div>
          </dl>

          {error ? (
            <p className="status-inline error">
              Le hub ne peut pas joindre le backend pour le moment.
            </p>
          ) : null}
          {!error &&
            warnings.slice(1).map((warning) => (
              <p key={warning} className="status-inline warning">
                {warning}
              </p>
            ))}
        </div>
      </section>

      <section className="hub-grid">
        <article className="panel panel-primary">
          <div className="panel-heading">
            <p className="section-kicker">Resume</p>
            <h2>Ce qui compte maintenant</h2>
          </div>

          <div className="summary-strip" aria-label="Resume du hub">
            <article>
              <strong>{recentEvents.length}</strong>
              <span>evenements visibles</span>
            </article>
            <article>
              <strong>{data?.profiles.length ?? 0}</strong>
              <span>profils connus</span>
            </article>
            <article>
              <strong>{notifications?.sentCount ?? 0}</strong>
              <span>alertes envoyees</span>
            </article>
          </div>

          <div className="panel-cta-row">
            <a className="primary-cta" href="#history">
              Historique
            </a>
            <a className="secondary-cta" href="#cameras">
              Cameras
            </a>
            <a className="secondary-cta" href="#notifications">
              Notifications
            </a>
            <a className="secondary-cta" href="#profiles">
              Profils
            </a>
          </div>
        </article>

        <article className="panel panel-secondary" id="events">
          <div>
            <dt>Notifications</dt>
            <dd>{notifications ? formatNotificationStatus(notifications) : 'En attente'}</dd>
          </div>
          <div className="panel-heading">
            <p className="section-kicker">Evenements</p>
            <h2>Recents et intelligibles</h2>
          </div>

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
                      title="Voir l'apercu"
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
                  <h3>Aucun evenement recent</h3>
                  <p>Le hub affichera ici les detections des que l'API retournera des donnees.</p>
                </div>
              </article>
            )}
          </div>
        </article>

        <article className="panel panel-dark" id="profiles">
          <div className="panel-heading">
            <p className="section-kicker">Profils</p>
            <h2>Connus et actionnables</h2>
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
                  <h3>Aucun profil configure</h3>
                  <p>Les profils crees via l'API apparaitront ici.</p>
                </div>
              </article>
            )}
          </div>
        </article>

        <article className="panel panel-expert" id="expert">
          <div className="panel-heading">
            <p className="section-kicker">Mode avance</p>
            <h2>Interface avancee</h2>
          </div>

          <p className="expert-copy">Acces reserve aux reglages experts et au support.</p>

          <a
            className="expert-link"
            href={dashboardRuntime.frigateBaseUrl}
            target="_blank"
            rel="noreferrer"
          >
            Acceder a l&apos;interface experte
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
