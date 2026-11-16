import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../ui/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { useLayerExit } from './layer_exit'
import { PressableSurface } from './pressable'

/** What a row does: a tap on it, or a field it holds (a chosen day). */
type SheetOptionInput = { onPick: () => void; field?: never } | { field: ReactNode; onPick?: never }

/** One choice of a sheet: a tap applies it, nothing to confirm. */
export type SheetOption = SheetOptionInput & {
  key: string
  title: string
  /** A quieter second line, only when the title leaves something out. */
  detail?: string
  /** What the option is, drawn before its title. */
  icon?: ReactNode
  /** The axis it belongs to, for a choice along several (a filter): consecutive ones share a heading. */
  group?: string
  /** The current choice, checked. */
  selected?: boolean
  /** It destroys something, after its own confirmation: in coral ink. */
  destructive?: boolean
}

const ROW_CLASS = 'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left'

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
 * A sheet whose rows are checked and unchecked (`checkable`) stays open, closed by `Fermer`.
 */
export function Sheet({
  title,
  effect,
  options,
  checkable = false,
  onClose,
}: {
  title: string
  effect: ReactNode
  options: readonly SheetOption[]
  checkable?: boolean
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
              {ofGroup.map((option) => {
                const content = (
                  <>
                    {option.icon}
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
                  </>
                )
                const check = option.selected && (
                  <Check className="size-5 shrink-0" aria-hidden="true" />
                )
                return (
                  <li key={option.key}>
                    {option.field ? (
                      // A field takes its own taps: the row is its label, not a button.
                      <label className={cn(ROW_CLASS, 'focus-within:bg-accent')}>
                        {content}
                        {option.field}
                        {check}
                      </label>
                    ) : (
                      <PressableSurface>
                        <button
                          type="button"
                          aria-current={!checkable && option.selected ? 'true' : undefined}
                          aria-pressed={checkable ? Boolean(option.selected) : undefined}
                          className={cn(
                            ROW_CLASS,
                            'outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
                          )}
                          onClick={option.onPick}
                        >
                          {content}
                          {check}
                        </button>
                      </PressableSurface>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <Button type="button" variant="ghost" className="text-ink-muted" onClick={close}>
          {checkable ? 'Fermer' : 'Annuler'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
