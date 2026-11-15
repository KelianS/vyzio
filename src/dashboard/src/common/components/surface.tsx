import type { ComponentProps } from 'react'
import { Slot } from 'radix-ui'
import { cn } from '../ui/utils'

/** The three insets of a surface: content, a list whose rows carry their own, a picture that fills it. */
type SurfaceInset = 'content' | 'list' | 'none'

const INSET_CLASS: Record<SurfaceInset, string> = {
  content: 'p-5 sm:p-6',
  list: 'p-2',
  none: 'overflow-hidden',
}

/** A card or a page's panel (DESIGN SYSTEM § Interface tokens); `asChild` lends it to a section, a nav or an article. */
export function Surface({
  inset = 'content',
  asChild = false,
  className,
  ...props
}: ComponentProps<'div'> & { inset?: SurfaceInset; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div'
  return (
    <Comp
      className={cn('rounded-card bg-card text-card-foreground', INSET_CLASS[inset], className)}
      {...props}
    />
  )
}
