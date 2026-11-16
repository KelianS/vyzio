import { cn } from '../../../common/ui/utils'

// Readable over any picture: a round control on the glass (DESIGN SYSTEM § Palette).
export const LIVE_CONTROL =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-glass px-3 text-body font-semibold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

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
