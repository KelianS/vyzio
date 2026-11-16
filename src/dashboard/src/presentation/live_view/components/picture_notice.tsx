import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** In place of the picture, what keeps it from showing (PRIV-20, LIVE-23). */
export function PictureNotice({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-55 w-full flex-col items-center justify-center gap-3.5 rounded-card bg-picture px-5 py-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-icon-circle text-ink-muted">
        <Icon className="size-6.5" aria-hidden="true" />
      </span>
      <p className="text-row font-semibold">{title}</p>
      {children}
    </div>
  )
}
