import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '../ui/utils'

// Une miniature manque surtout quand la surveillance redemarre : la cause se resout d'elle-meme,
// donc on retente, en espacant. Passe ces essais, c'est a l'utilisateur de redemander.
const RETRY_DELAYS_MS = [2000, 5000, 10000]

type Phase = 'loading' | 'loaded' | 'retrying' | 'failed'

interface DetectionThumbnailProps {
  src: string
  /** Vide quand la vignette accompagne un libelle qui dit deja de quoi il s'agit. */
  alt?: string
  className?: string
}

/** L'apercu d'une detection : jamais une image cassee, jamais un echec definitif sans recours. */
export function DetectionThumbnail({ src, alt = '', className }: DetectionThumbnailProps) {
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')

  // Une source neuve efface l'echec de la precedente sans cascade de setState dans un effet.
  const [previousSrc, setPreviousSrc] = useState(src)
  if (src !== previousSrc) {
    setPreviousSrc(src)
    setAttempt(0)
    setPhase('loading')
  }

  useEffect(() => {
    if (phase !== 'retrying') return
    const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
    const timer = setTimeout(() => {
      setAttempt((previous) => previous + 1)
      setPhase('loading')
    }, delay)
    return () => clearTimeout(timer)
  }, [phase, attempt])

  function retryNow() {
    setAttempt((previous) => previous + 1)
    setPhase('loading')
  }

  const busy = phase === 'loading' || phase === 'retrying'

  return (
    <span
      className={cn(
        'relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted',
        className,
      )}
    >
      <img
        // Le cache du navigateur garde l'echec : sans cette cle, retenter ne redemande rien.
        src={attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`}
        alt={alt}
        loading="lazy"
        className={cn('size-full object-cover', phase !== 'loaded' && 'invisible')}
        onLoad={() => setPhase('loaded')}
        onError={() => setPhase(attempt < RETRY_DELAYS_MS.length ? 'retrying' : 'failed')}
      />

      {busy && (
        <span
          role="status"
          aria-label="Chargement de l’aperçu"
          className="absolute size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
        />
      )}

      {phase === 'failed' && (
        <button
          type="button"
          aria-label="Réessayer de charger l’aperçu"
          title="Aperçu indisponible — réessayer"
          onClick={retryNow}
          className="absolute inset-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
