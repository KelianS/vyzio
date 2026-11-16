import { useEffect, useRef, useState } from 'react'
import { ExternalLink, TriangleAlert } from 'lucide-react'
import { SettingsPage } from '../../common/settings/settings_page'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { SecondaryButton } from '../../common/components/secondary_button'
import { Skeleton } from '../../common/ui/skeleton'
import { PageHeader } from '../../common/components/page_header'

// One file: a local timeout is its only state, and it calls no use case.
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

  const header = <PageHeader title="Interface technique" />

  if (timedOut && !loaded) {
    return (
      <SettingsPage>
        {header}
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-1 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h2 className="text-row font-semibold">Frigate inaccessible</h2>
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
              <SecondaryButton icon={ExternalLink} href={frigateBaseUrl}>
                Ouvrir Frigate dans un onglet
              </SecondaryButton>
            </div>
          </div>
        </div>
      </SettingsPage>
    )
  }

  return (
    <div className="relative h-[calc(100vh-10rem)] min-h-100">
      {header}
      {!loaded && (
        <Skeleton
          role="status"
          className="absolute inset-0 rounded-card bg-card"
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
