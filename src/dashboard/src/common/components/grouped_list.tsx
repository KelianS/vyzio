import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '../ui/utils'
import { PressableSurface } from './pressable'
import { StatusMark } from './status_mark'
import type { StatusMarkState } from './status_mark_state'

/** A section of grouped rows (DESIGN SYSTEM § Grouped lists): its quiet label, then one surface. */
export function GroupedList({
  label,
  labelAside,
  className,
  children,
}: {
  label?: string
  /** Beside the label: a sign that the list is still filling, such as a search running. */
  labelAside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-label={label} className={cn('flex flex-col gap-2', className)}>
      {label && (
        <h2 className="ml-1 flex items-center gap-2 text-label font-semibold text-muted-foreground">
          {label}
          {labelAside}
        </h2>
      )}
      <ul className="overflow-hidden rounded-card bg-card">{children}</ul>
    </section>
  )
}

/** The line between two rows starts where the text does: under the icon circle, or at the row's inset. */
const ROW_ITEM =
  'relative not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:h-px not-first:before:bg-border'

/** One row's place in its list, with the line that parts it from the row above. */
export function GroupedItem({
  inset = 'text',
  className,
  children,
}: {
  /** Where the line above starts: under the title when the row has an icon, else at the row's edge. */
  inset?: 'icon' | 'text'
  className?: string
  children: ReactNode
}) {
  return (
    <li
      className={cn(
        ROW_ITEM,
        inset === 'icon' ? 'not-first:before:left-17.5' : 'not-first:before:left-4',
        className,
      )}
    >
      {children}
    </li>
  )
}

type RowDestination =
  | { to: string; onClick?: never; href?: never }
  | { to?: never; onClick: () => void; href?: never }
  | { to?: never; onClick?: never; href: string }

type GroupedRowProps = RowDestination & {
  /** The row's round neutral icon. */
  icon?: LucideIcon
  title: ReactNode
  mark?: StatusMarkState
  /** Only for an exception or a state to act on: a list reads as names (UI-31). */
  subtitle?: ReactNode
  /** What the row leads to, a chevron by default for a link; `none` for a row that adds something. */
  trailing?: ReactNode | 'none'
  current?: boolean
  disabled?: boolean
  /** The row's title weight: medium for a way in, semibold for a thing's name. */
  weight?: 'name' | 'action'
}

const ROW_CLASS =
  'flex w-full items-center gap-3.5 px-4 py-2 text-left outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50'

/** A row of a grouped list that leads somewhere or does something: icon, title with its mark, subtitle, chevron. */
export function GroupedRow({
  icon: Icon,
  title,
  mark,
  subtitle,
  trailing,
  current,
  disabled,
  weight = 'name',
  to,
  onClick,
  href,
}: GroupedRowProps) {
  const content = (
    <>
      {Icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-icon-circle text-ink-muted">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'flex items-center gap-2 text-row',
            weight === 'name' ? 'font-semibold' : 'font-medium',
          )}
        >
          <span className="min-w-0 break-words">{title}</span>
          {mark && <StatusMark {...mark} />}
        </span>
        {/* A space between the lines, so a reader says them as two words, not one. */}
        {subtitle && ' '}
        {subtitle && <span className="text-body text-muted-foreground">{subtitle}</span>}
      </span>
      {trailing === undefined
        ? to !== undefined && (
            <ChevronRight className="size-5 shrink-0 text-mark-off" aria-hidden="true" />
          )
        : trailing !== 'none' && trailing}
    </>
  )
  const height = Icon ? 'min-h-16' : 'min-h-14'

  return (
    <GroupedItem inset={Icon ? 'icon' : 'text'}>
      <PressableSurface>
        {to !== undefined ? (
          <Link
            to={to}
            aria-current={current ? 'page' : undefined}
            aria-disabled={disabled || undefined}
            className={cn(ROW_CLASS, height)}
          >
            {content}
          </Link>
        ) : href !== undefined ? (
          <a href={href} target="_blank" rel="noreferrer" className={cn(ROW_CLASS, height)}>
            {content}
          </a>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(ROW_CLASS, height)}
          >
            {content}
          </button>
        )}
      </PressableSurface>
    </GroupedItem>
  )
}
