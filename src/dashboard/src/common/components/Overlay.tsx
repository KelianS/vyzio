import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../ui/utils'

/**
 * Plein ecran sombre pour regarder une image ou une video.
 *
 * Distinct de `ConfirmModal` : ici rien n'est demande, on montre. Fermer est
 * donc offert partout — le bouton, et le fond lui-meme.
 */
export function Overlay({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-label={label}
      onClick={onClose}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-surface-inverse/85 backdrop-blur-sm',
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Fermer"
        className="absolute top-4 right-4 text-surface-inverse-foreground hover:bg-white/10"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </Button>

      {/* Le contenu ne ferme pas : on clique dedans pour lire une video. */}
      <div className="max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
