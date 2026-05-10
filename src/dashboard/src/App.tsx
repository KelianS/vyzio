import './App.css'

const recentEvents = [
  {
    title: 'Alice detectee',
    detail: 'Porte d entree',
    time: '10:15',
    tone: 'high',
  },
  {
    title: 'Vehicule detecte',
    detail: 'Allee principale',
    time: '09:42',
    tone: 'normal',
  },
  {
    title: 'Telegram actif',
    detail: 'Derniere alerte envoyee sans erreur',
    time: '09:30',
    tone: 'ok',
  },
] as const

const quickActions = [
  'Consulter les evenements recents',
  'Gerer les profils connus',
  'Verifier les alertes Telegram',
] as const

function App() {
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
          <div className="status-pill online">Systeme operationnel</div>
          <dl className="status-facts">
            <div>
              <dt>Flux principal</dt>
              <dd>Frigate connecte</dd>
            </div>
            <div>
              <dt>Derniere alerte</dt>
              <dd>Il y a 3 min</dd>
            </div>
            <div>
              <dt>Canal prioritaire</dt>
              <dd>Telegram</dd>
            </div>
          </dl>
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

          <div className="panel-cta-row">
            <a className="primary-cta" href="#events">Voir les evenements</a>
            <a className="secondary-cta" href="#expert">Mode avance</a>
          </div>
        </article>

        <article className="panel panel-secondary" id="events">
          <div className="panel-heading">
            <p className="section-kicker">Evenements</p>
            <h2>Recents et intelligibles</h2>
          </div>

          <div className="event-list">
            {recentEvents.map((event) => (
              <article key={`${event.title}-${event.time}`} className={`event-card ${event.tone}`}>
                <div>
                  <h3>{event.title}</h3>
                  <p>{event.detail}</p>
                </div>
                <span>{event.time}</span>
              </article>
            ))}
          </div>
        </article>

        <article className="panel panel-dark">
          <div className="panel-heading">
            <p className="section-kicker">Parcours MVP</p>
            <h2>Ce que le hub doit rendre simple</h2>
          </div>

          <ul className="principle-list">
            <li>Voir si le systeme fonctionne correctement.</li>
            <li>Retrouver les derniers evenements sans menus experts.</li>
            <li>Acceder aux profils et alertes depuis la meme interface.</li>
          </ul>
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

          <a className="expert-link" href="http://localhost:5000" target="_blank" rel="noreferrer">
            Ouvrir Frigate en mode avance
          </a>
        </article>
      </section>
    </main>
  )
}

export default App
