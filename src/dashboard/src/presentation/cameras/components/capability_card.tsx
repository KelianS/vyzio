import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '../../../common/components/badge'
import { Fold } from '../../../common/components/fold'

/** One capability, in the anatomy every card shares: title, state pill, state line, settings, actions (DESIGN SYSTEM § Capability cards). */
export function CapabilityCard({
  title,
  pill,
  children,
  options,
  actions,
}: {
  title: string
  pill: { label: string; tone: BadgeTone }
  /** The state line. */
  children?: ReactNode
  /** The protocol choice and the capability's own settings, behind the card's fold. */
  options?: ReactNode
  actions?: ReactNode
}) {
  return (
    <li className="rounded-inset border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg">{title}</h3>
        <Badge tone={pill.tone}>{pill.label}</Badge>
      </div>
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
