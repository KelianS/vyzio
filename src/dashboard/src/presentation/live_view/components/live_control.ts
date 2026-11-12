import { cn } from '../../../common/ui/utils'

// Readable over any picture: the inverse surface, dimmed.
export const LIVE_CONTROL =
  'press inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-surface-inverse/70 px-3 text-xs font-semibold text-surface-inverse-foreground'

/** A faded control leaves the page and its focus order, so nothing invisible can be pressed. */
export function fading(shown: boolean) {
  return {
    // Back fast on the user's tap, away slowly on the system's own (DESIGN SYSTEM § Motion).
    className: cn(
      'transition-[opacity,visibility]',
      shown ? 'duration-(--duration-short)' : 'invisible opacity-0 duration-(--duration-long)',
    ),
    inert: !shown,
    'aria-hidden': shown ? undefined : true,
  }
}
