import { useEffect, useState, type ReactNode } from 'react'
import { Skeleton } from '../ui/skeleton'
import { cn } from '../ui/utils'

/** Long enough for a fast answer to land before anything shows, short enough that a slow one is never blank. */
const LOADING_DELAY_MS = 250

const LINE_WIDTHS = ['w-1/3', 'w-2/3', 'w-1/2'] as const

/** A read in progress (DESIGN SYSTEM § Empty and loading): nothing at first, then the shape of what it replaces, lines by default. */
export function Loading({
  lines = 3,
  className,
  children,
}: {
  lines?: number
  className?: string
  children?: ReactNode
}) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), LOADING_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      role="status"
      aria-label="Chargement"
      className={cn('flex flex-col gap-3 py-2', className)}
    >
      {shown &&
        (children ??
          Array.from({ length: lines }, (_, index) => (
            <Skeleton
              key={index}
              className={cn('h-4 rounded-full', LINE_WIDTHS[index % LINE_WIDTHS.length])}
            />
          )))}
    </div>
  )
}
