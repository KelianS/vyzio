import { cn } from '../ui/utils'

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
