import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../ui/utils'
import { Badge, type BadgeTone } from './badge'

/** The way back above a page title. */
export function BackLink({
  to,
  className,
  children,
}: {
  to: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  )
}

/** A page's header (DESIGN SYSTEM § Page header): the state is the pill its list shows, word and tone. */
export function PageHeader({
  back,
  title,
  state,
  className,
}: {
  back?: { to: string; label: string }
  title: ReactNode
  state?: { tone: BadgeTone; label: string }
  className?: string
}) {
  return (
    <div className={className}>
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', back && 'mt-1')}>
        <h1 className="font-serif text-3xl">{title}</h1>
        {state && <Badge tone={state.tone}>{state.label}</Badge>}
      </div>
    </div>
  )
}
