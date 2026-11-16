import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../ui/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { useLayerExit } from './layer_exit'
import { PressableSurface } from './pressable'

/** One choice of a sheet: a tap applies it and closes the sheet, nothing to confirm. */
export interface SheetOption {
  key: string
  title: string
  /** A quieter second line, only when the title leaves something out. */
  detail?: string
  /** The axis it belongs to, for a choice along several (a filter): consecutive ones share a heading. */
  group?: string
  /** The current choice, checked. */
  selected?: boolean
  /** It destroys something, after its own confirmation: in coral ink. */
  destructive?: boolean
  onPick: () => void
}

/** Consecutive options of one axis, under its heading. */
function groupsOf(options: readonly SheetOption[]): { group?: string; options: SheetOption[] }[] {
  const groups: { group?: string; options: SheetOption[] }[] = []
  for (const option of options) {
    const last = groups.at(-1)
    if (last && last.group === option.group) last.options.push(option)
    else groups.push({ group: option.group, options: [option] })
  }
  return groups
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
        className="[--tw-enter-scale:1]! [--tw-exit-scale:1]! top-auto bottom-0 max-h-[90dvh] overflow-y-auto left-1/2 flex max-w-none -translate-x-1/2 translate-y-0 flex-col gap-4 rounded-t-panel rounded-b-none px-4 pt-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:max-w-lg"
      >
        <div className="flex flex-col gap-1 px-1">
          <DialogTitle className="text-title font-bold">{title}</DialogTitle>
          <DialogDescription className="text-body text-muted-foreground">
            {effect}
          </DialogDescription>
        </div>
        {groupsOf(options).map(({ group, options: ofGroup }) => (
          <section key={group ?? ''} aria-label={group} className="flex flex-col gap-2">
            {group && (
              <h3 className="ml-1 text-label font-semibold text-muted-foreground">{group}</h3>
            )}
            <ul className="divide-y divide-border overflow-hidden rounded-card bg-secondary">
              {ofGroup.map((option) => (
                <li key={option.key}>
                  <PressableSurface>
                    <button
                      type="button"
                      aria-current={option.selected ? 'true' : undefined}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
                      onClick={option.onPick}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={cn(
                            'text-row font-medium',
                            option.destructive && 'text-destructive',
                          )}
                        >
                          {option.title}
                        </span>
                        {option.detail && (
                          <span className="text-body text-muted-foreground">{option.detail}</span>
                        )}
                      </span>
                      {option.selected && <Check className="size-5 shrink-0" aria-hidden="true" />}
                    </button>
                  </PressableSurface>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Button type="button" variant="ghost" className="text-ink-muted" onClick={close}>
          Annuler
        </Button>
      </DialogContent>
    </Dialog>
  )
}
