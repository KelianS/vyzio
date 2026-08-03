import { useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'

// Static-ish screen: local timeout state only, no domain/use-case call to orchestrate — same
// exception as the template's "zero async work" single-file screen.
export function ExpertView() {
  const { frigateBaseUrl } = useAppContainer()
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
      <SettingsPage>
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-1 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h1 className="font-serif text-3xl">Frigate inaccessible</h1>
            <p className="mt-1 text-muted-foreground">
              L’interface Frigate n’a pas pu être chargée dans les délais.
            </p>

            <p className="mt-5 font-medium">À vérifier :</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Le service Frigate est bien démarré.</li>
              <li>
                L’adresse <code>{frigateBaseUrl}</code> est joignable depuis ce navigateur.
              </li>
              <li>
                Frigate n’est pas configuré avec <code>X-Frame-Options: DENY</code>.
              </li>
            </ol>

            <div className="mt-5">
              <Button asChild variant="outline">
                <a href={frigateBaseUrl} target="_blank" rel="noreferrer">
                  Ouvrir Frigate dans un onglet
                </a>
              </Button>
            </div>
          </div>
        </div>
      </SettingsPage>
    )
  }

  return (
    <div className="relative h-[calc(100vh-6rem)] min-h-100">
      {!loaded && (
        <div
          role="status"
          className="absolute inset-0 animate-pulse rounded-card bg-card"
          aria-label="Chargement de Frigate…"
        />
      )}
      <iframe
        src={frigateBaseUrl}
        className={loaded ? 'size-full rounded-card' : 'invisible size-full rounded-card'}
        onLoad={handleLoad}
        title="Frigate NVR"
        allow="fullscreen"
      />
    </div>
  )
}
