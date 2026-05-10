import './App.css'

function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Vyzio dashboard</p>
        <h1>Workspace in reset mode</h1>
        <p className="lede">
          The implementation plan is being reviewed before new product work resumes.
          This frontend stays intentionally minimal until the MVP flows are locked.
        </p>
      </section>

      <section className="status-grid" aria-label="Project status">
        <article className="status-card accent">
          <h2>Current focus</h2>
          <p>Align runtime, backlog, and architecture before adding features.</p>
        </article>
        <article className="status-card">
          <h2>Default runtime</h2>
          <p>Frigate plus the .NET API remain in the nominal path. Experimental services stay out.</p>
        </article>
        <article className="status-card">
          <h2>Next review</h2>
          <p>Validate the reset backlog, then reopen implementation one story at a time.</p>
        </article>
      </section>
    </main>
  )
}

export default App
