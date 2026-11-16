import { useState, type ReactNode } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Fold } from '../../../common/components/fold'
import { GroupedItem } from '../../../common/components/grouped_list'
import { StatusMark } from '../../../common/components/status_mark'
import {
  markSubtitle,
  StatusMarkKind,
  type StatusMarkState,
} from '../../../common/components/status_mark_state'

/**
 * One capability as a row of the grouped list (CAM-23): its icon, its title with its mark, the
 * word of an exception; the row opens its card, in the anatomy every card shares: state line,
 * settings, actions (DESIGN SYSTEM § Cards). A capability with something to act on opens unasked.
 */
export function CapabilityCard({
  icon: Icon,
  title,
  mark,
  children,
  options,
  actions,
}: {
  icon: LucideIcon
  title: string
  /** Absent while the capability is not read yet: no mark can be true then. */
  mark?: StatusMarkState
  /** The state line. */
  children?: ReactNode
  /** The protocol choice and the capability's own settings, behind the card's fold. */
  options?: ReactNode
  actions?: ReactNode
}) {
  const subtitle = mark && markSubtitle(mark)
  // Decided once the state is first read, then left to the user: an answer never snaps it shut.
  const [open, setOpen] = useState<boolean | null>(null)
  if (open === null && mark !== undefined) setOpen(mark.kind !== StatusMarkKind.On)

  return (
    <GroupedItem inset="icon">
      <details
        open={open ?? false}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group/card"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3.5 px-4 py-2 outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-icon-circle text-ink-muted">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <h3 className="text-row font-semibold">{title}</h3>
              {mark && <StatusMark {...mark} />}
            </span>
            {/* Only an exception is written in words, under the title (UI-31). */}
            {subtitle && <span className="text-body text-muted-foreground">{subtitle}</span>}
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-mark-off transition-transform group-open/card:rotate-90"
            aria-hidden="true"
          />
        </summary>
        <div className="flex flex-col px-4 pb-4 pl-[4.375rem]">
          {children && <div className="flex flex-col gap-1">{children}</div>}
          {/* Drawn once opened, so a card never offers two buttons of the same name at once. */}
          {options && (
            <Fold summary="Options" lazy bodyClassName="flex flex-col gap-3 px-3 pt-1 pb-3">
              {options}
            </Fold>
          )}
          {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </details>
    </GroupedItem>
  )
}
