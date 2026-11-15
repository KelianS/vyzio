import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../ui/button'

type Destination =
  { to?: never; href?: never } | { to: string; href?: never } | { to?: never; href: string }

type SecondaryButtonProps = Omit<
  ComponentProps<typeof Button>,
  'variant' | 'asChild' | 'children'
> &
  Destination & {
    /** The icon that names the action: a secondary action never goes without one (DESIGN SYSTEM § Action weight). */
    icon: LucideIcon
    /** For an icon that moves while the action runs, such as a turning refresh. */
    iconClassName?: string
    /** A toggle drawn filled while it is on: a state, not a second main action. */
    active?: boolean
    children: ReactNode
  }

/** Every action of a view but its main one: an icon and an ink label on the neutral tint. */
export function SecondaryButton({
  icon: Icon,
  iconClassName,
  active = false,
  to,
  href,
  children,
  ...props
}: SecondaryButtonProps) {
  const variant = active ? 'default' : 'secondary'
  const content = (
    <>
      <Icon className={iconClassName} aria-hidden="true" />
      {children}
    </>
  )

  if (to !== undefined)
    return (
      <Button asChild variant={variant} {...props}>
        <Link to={to}>{content}</Link>
      </Button>
    )
  if (href !== undefined)
    return (
      <Button asChild variant={variant} {...props}>
        <a href={href} target="_blank" rel="noreferrer">
          {content}
        </a>
      </Button>
    )
  return (
    <Button variant={variant} {...props}>
      {content}
    </Button>
  )
}
