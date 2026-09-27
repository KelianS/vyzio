import type { MouseEvent, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'

/** Full-screen dark viewer for an image or video, shows and asks nothing, unlike ConfirmModal. */
export function Overlay({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  // Only the backdrop itself closes: a click in the content, or bubbling from a layer it opened, does not.
  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    // On the Radix Dialog like every other layer, so a layer opened from inside stacks above it (ADR-42).
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onClick={closeOnBackdrop}
        // The backdrop is the content itself; the only thing outside is a toast, read without closing.
        onInteractOutside={(event) => event.preventDefault()}
        className="inset-0 flex h-full max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 rounded-none border-0 bg-surface-inverse/70 p-4 shadow-none backdrop-blur-sm sm:max-w-none"
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {/* `z-10`: the content, rendered after it, would otherwise cover the cross. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fermer"
          className="absolute top-4 right-4 z-10 rounded-full bg-surface-inverse/70 text-surface-inverse-foreground hover:bg-surface-inverse"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>

        <div className="max-h-full max-w-full">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
