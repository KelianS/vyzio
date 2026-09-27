import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '../../../common/components/badge'

/** One capability, in the anatomy every card shares: title, state pill, state line, settings, actions (DESIGN SYSTEM § Capability cards). */
export function CapabilityCard({
  title,
  pill,
  children,
  actions,
}: {
  title: string
  pill: { label: string; tone: BadgeTone }
  /** The state line, then the capability's own settings. */
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <li className="rounded-inset border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg">{title}</h3>
        <Badge tone={pill.tone}>{pill.label}</Badge>
      </div>
      {children && <div className="mt-1 flex flex-col gap-1">{children}</div>}
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </li>
  )
}
