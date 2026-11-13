import type { ComponentProps } from 'react'
import { Item } from '../ui/item'
import { cn } from '../ui/utils'

/** A full-width list row that leads somewhere or picks something; its one child is the link or the button. */
export function ListRow({ className, ...props }: Omit<ComponentProps<typeof Item>, 'asChild'>) {
  return (
    <Item
      asChild
      className={cn('flex-nowrap justify-between gap-3 rounded-none px-0 py-3 text-base', className)}
      {...props}
    />
  )
}
