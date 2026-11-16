import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { PressableSurface } from '../../../common/components/pressable'
import { cn } from '../../../common/ui/utils'

/** A subtitle only for an exception; a Silence speaks in its own colour (UI-32). */
type TileSubtitle = string | { text: string; silence: true } | null

/** A shortcut of the home: its icon, its name, and a subtitle only when something is to know. */
export function HomeTile({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string
  icon: LucideIcon
  title: string
  subtitle: TileSubtitle
}) {
  const text = typeof subtitle === 'string' ? subtitle : subtitle?.text
  const silence = typeof subtitle === 'object' && subtitle !== null

  return (
    <PressableSurface>
      <Link
        to={to}
        className="flex min-h-30 flex-col justify-between gap-3 rounded-card bg-card p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-icon-circle text-ink-muted">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-row font-semibold">{title}</span>
          {text && (
            <span className={cn('text-body', silence ? 'text-silence' : 'text-muted-foreground')}>
              {text}
            </span>
          )}
        </span>
      </Link>
    </PressableSurface>
  )
}
