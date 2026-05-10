import './App.css'
import { dashboardRuntime, getHubOverview } from './app/dependencies'
import { useHubOverview } from './ui/hooks/useHubOverview'
import {
  formatEventDetail,
  formatEventTime,
  formatEventTitle,
  formatLastSeen,
  formatProfileMeta,
  getEventTone,
} from './ui/formatters/hub'

const quickActions = ['Consulter les evenements recents', 'Gerer les profils connus', 'Verifier les alertes Telegram'] as const

function App() {
  const { data, loading, error } = useHubOverview(getHubOverview)
  const recentEvents = data?.recentEvents ?? []
  const recentProfiles = data?.profiles.slice(0, 3) ?? []
  const lastEvent = recentEvents[0]

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Hub Vyzio</p>
          <h1>Votre surveillance utile, sans interface technique.</h1>
          <p className="lede">
            Le hub centralise l'etat du systeme, les derniers evenements et les actions
            prioritaires. Les reglages avances Frigate restent disponibles, mais hors du
            parcours principal.
          </p>
        </div>

        <div className="hero-status" aria-label="Etat general du systeme">
          <div className={`status-pill ${data?.systemHealthy ? 'online' : 'degraded'}`}>
            {data?.systemHealthy ? 'Systeme operationnel' : 'Verification requise'}
          </div>
          <dl className="status-facts">
            <div>
              <dt>Flux principal</dt>
              <dd>{data?.systemHealthy ? 'API disponible' : 'API indisponible'}</dd>
            </div>
            <div>
              <dt>Derniere alerte</dt>
              <dd>{lastEvent ? formatEventTime(lastEvent.occurredAt) : 'Aucune donnee'}</dd>
            </div>
            <div>
              <dt>Canal prioritaire</dt>
              <dd>Telegram</dd>
            </div>
          </dl>

          {loading ? <p className="status-inline">Chargement du hub...</p> : null}
          {error ? <p className="status-inline error">{error}</p> : null}
        </div>
      </section>

      <section className="hub-grid">
        <article className="panel panel-primary">
          <div className="panel-heading">
            <p className="section-kicker">Accueil</p>
            <h2>Actions principales</h2>
          </div>

          <ul className="action-list" aria-label="Actions principales">
            {quickActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>

          <div className="summary-strip" aria-label="Resume du hub">
            <article>
              <strong>{recentEvents.length}</strong>
              <span>evenements visibles</span>
            </article>
            <article>
              <strong>{data?.profiles.length ?? 0}</strong>
              <span>profils connus</span>
            </article>
          </div>

          <div className="panel-cta-row">
            <a className="primary-cta" href="#events">Voir les evenements</a>
            <a className="secondary-cta" href="#profiles">Profils</a>
          </div>
        </article>

        <article className="panel panel-secondary" id="events">
          <div className="panel-heading">
            <p className="section-kicker">Evenements</p>
            <h2>Recents et intelligibles</h2>
          </div>

          <div className="event-list">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <article key={event.eventId} className={`event-card ${getEventTone(event)}`}>
                  <div>
                    <h3>{formatEventTitle(event)}</h3>
                    <p>{formatEventDetail(event)}</p>
                  </div>
                  <span>{formatEventTime(event.occurredAt)}</span>
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
            <h2>Acces Frigate hors parcours nominal</h2>
          </div>

          <p className="expert-copy">
            Pour les reglages experts ou le support, Frigate reste accessible comme outil
            avance. Le hub Vyzio ne tente pas de reconstruire l'integralite de son interface.
          </p>

          <a className="expert-link" href={dashboardRuntime.frigateBaseUrl} target="_blank" rel="noreferrer">
            Ouvrir Frigate en mode avance
          </a>
        </article>
      </section>
    </main>
  )
}

export default App
