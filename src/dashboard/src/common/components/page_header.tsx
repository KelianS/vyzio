import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from './badge'
import { TopBarTitle } from './top_bar'

/** A page's title (DESIGN SYSTEM § Page header): it lives in the top bar, never repeated in the page. */
export function PageHeader({
  title,
  state,
}: {
  title: ReactNode
  state?: { tone: BadgeTone; label: string }
}) {
  return (
    <TopBarTitle>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="min-w-0 text-title font-bold break-words">{title}</h1>
        {state && <Badge tone={state.tone}>{state.label}</Badge>}
      </div>
    </TopBarTitle>
  )
}
