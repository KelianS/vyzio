import type { ReactNode } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { useLayerExit } from './layer_exit'
import { PressableSurface } from './pressable'

/** One choice of a sheet: a tap applies it and closes the sheet, nothing to confirm. */
export interface SheetOption {
  key: string
  title: string
  /** A quieter second line, only when the title leaves something out. */
  detail?: string
  onPick: () => void
}

/**
 * A quick, reversible choice rising from the bottom edge (DESIGN SYSTEM § Sheets): a title, the
 * effect in one line, the options as rows, `Annuler` last. Its caller mounts it while it shows.
 */
export function Sheet({
  title,
  effect,
  options,
  onClose,
}: {
  title: string
  effect: ReactNode
  options: readonly SheetOption[]
  onClose: () => void
}) {
  const { open, ref, close } = useLayerExit<HTMLDivElement>(onClose)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        ref={ref}
        showCloseButton={false}
        // Anchored to the bottom edge, rising from it rather than growing from the centre.
        className="[--tw-enter-scale:1]! [--tw-exit-scale:1]! top-auto bottom-0 left-1/2 flex max-w-none -translate-x-1/2 translate-y-0 flex-col gap-4 rounded-t-panel rounded-b-none px-4 pt-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:max-w-lg"
      >
        <div className="flex flex-col gap-1 px-1">
          <DialogTitle className="text-title font-bold">{title}</DialogTitle>
          <DialogDescription className="text-body text-muted-foreground">
            {effect}
          </DialogDescription>
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-card bg-secondary">
          {options.map((option) => (
            <li key={option.key}>
              <PressableSurface>
                <button
                  type="button"
                  className="flex min-h-14 w-full flex-col justify-center gap-0.5 px-4 py-2 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                  onClick={option.onPick}
                >
                  <span className="text-row font-medium">{option.title}</span>
                  {option.detail && (
                    <span className="text-body text-muted-foreground">{option.detail}</span>
                  )}
                </button>
              </PressableSurface>
            </li>
          ))}
        </ul>
        <Button type="button" variant="ghost" className="text-ink-muted" onClick={close}>
          Annuler
        </Button>
      </DialogContent>
    </Dialog>
  )
}
