import type { ReactNode } from 'react'
import { StatusMark } from './status_mark'
import type { StatusMarkState } from './status_mark_state'
import { TopBarTitle } from './top_bar'

/** A page's title (DESIGN SYSTEM § Page header): it lives in the top bar, never repeated in the page. */
export function PageHeader({ title, mark }: { title: ReactNode; mark?: StatusMarkState }) {
  return (
    <TopBarTitle>
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="min-w-0 text-title font-bold break-words">{title}</h1>
        {mark && <StatusMark {...mark} />}
      </div>
    </TopBarTitle>
  )
}
