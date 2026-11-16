import type { ReactNode } from 'react'
import { Fold } from '../../../common/components/fold'
import { StatusMark } from '../../../common/components/status_mark'
import { markSubtitle, type StatusMarkState } from '../../../common/components/status_mark_state'

/** One capability, in the anatomy every card shares: title with its mark, state line, settings, actions (DESIGN SYSTEM § Cards). */
export function CapabilityCard({
  title,
  mark,
  children,
  options,
  actions,
}: {
  title: string
  /** Absent while the capability is not read yet: no mark can be true then. */
  mark?: StatusMarkState
  /** The state line. */
  children?: ReactNode
  /** The protocol choice and the capability's own settings, behind the card's fold. */
  options?: ReactNode
  actions?: ReactNode
}) {
  return (
    <li className="rounded-inset border border-border p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-row">{title}</h3>
        {mark && <StatusMark {...mark} />}
      </div>
      {/* Only an exception is written in words, under the title (UI-31). */}
      {mark && markSubtitle(mark) && (
        <p className="text-body text-muted-foreground">{markSubtitle(mark)}</p>
      )}
      {children && <div className="mt-1 flex flex-col gap-1">{children}</div>}
      {/* Drawn once opened, so a card never offers two buttons of the same name at once. */}
      {options && (
        <Fold summary="Options" lazy bodyClassName="flex flex-col gap-3 px-3 pt-1 pb-3">
          {options}
        </Fold>
      )}
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </li>
  )
}
