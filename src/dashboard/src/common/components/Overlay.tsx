import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../ui/utils'

/** Full-screen dark viewer for an image or video — shows, asks nothing, unlike ConfirmModal. */
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

      {/* Content doesn't close on click: needed to interact with a video. */}
      <div className="max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
