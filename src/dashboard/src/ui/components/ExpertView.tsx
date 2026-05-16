import { useEffect, useRef, useState } from 'react'

interface ExpertViewProps {
  frigateBaseUrl: string
}

export function ExpertView({ frigateBaseUrl }: ExpertViewProps) {
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => setTimedOut(true), 10000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleLoad() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setLoaded(true)
    setTimedOut(false)
  }

  if (timedOut && !loaded) {
    return (
      <main className="app-shell">
        <div className="panel expert-error-panel">
          <div className="hub-degraded-icon" aria-hidden="true">⚠</div>
          <div>
            <p className="eyebrow">Expert</p>
            <h1>Frigate inaccessible</h1>
            <p className="lede">L'interface Frigate n'a pas pu être chargée dans les délais.</p>
          </div>
          <div className="hub-degraded-steps">
            <p>Vérifiez que :</p>
            <ol>
              <li>Le service Frigate est bien démarré</li>
              <li>L'adresse <code>{frigateBaseUrl}</code> est joignable depuis ce navigateur</li>
              <li>Frigate n'est pas configuré avec <code>X-Frame-Options: DENY</code></li>
            </ol>
          </div>
          <div className="panel-cta-row">
            <a href={frigateBaseUrl} target="_blank" rel="noreferrer" className="primary-cta">
              Ouvrir Frigate dans un onglet
            </a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="expert-shell">
      {!loaded && (
        <div className="hub-skeleton expert-skeleton" aria-label="Chargement de Frigate..." />
      )}
      <iframe
        src={frigateBaseUrl}
        className={`expert-iframe${loaded ? '' : ' expert-iframe--hidden'}`}
        onLoad={handleLoad}
        title="Frigate NVR"
        allow="fullscreen"
      />
    </div>
  )
}
