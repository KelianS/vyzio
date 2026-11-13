import type { ReactNode } from 'react'
import { ArrowLeft, Maximize, Minimize } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import { fading, LIVE_CONTROL } from './live_control'
import { PressableControl } from '../../../common/components/pressable'

/** The top bar: back, the camera's name, then the picture's own controls (DESIGN SYSTEM § Full-screen viewing). */
export function LiveTopBar({
  label,
  shown,
  above = false,
  onBack,
  onFullScreen,
  onLeaveFullScreen,
  children,
}: {
  label: string
  shown: boolean
  /** Above the picture rather than over it: a solid strip instead of a gradient. */
  above?: boolean
  onBack: () => void
  /** Given only while the browser can still be asked to hide its bars. */
  onFullScreen?: () => void
  /** Given only while the browser hides its bars: its own swipe hint does not always leave. */
  onLeaveFullScreen?: () => void
  children?: ReactNode
}) {
  const fade = fading(shown)

  return (
    <div
      {...fade}
      data-press-only
      className={cn(
        'flex items-center gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] text-surface-inverse-foreground',
        above
          ? 'bg-surface-inverse pb-2'
          : 'absolute inset-x-0 top-0 bg-linear-to-b from-surface-inverse/80 to-transparent pb-6',
        fade.className,
      )}
    >
      <PressableControl>
        <button
          type="button"
          className={LIVE_CONTROL}
          aria-label="Retour"
          // Leaving is not a gesture to go full screen: the screen would ask for it as it goes.
          onClick={(event) => {
            event.stopPropagation()
            onBack()
          }}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
      </PressableControl>
      <p className="min-w-0 flex-1 truncate font-medium">{label}</p>
      {children}
      {onFullScreen && (
        <PressableControl>
          <button
            type="button"
            className={LIVE_CONTROL}
            aria-label="Plein écran"
            onClick={onFullScreen}
          >
            <Maximize className="size-4" aria-hidden="true" />
          </button>
        </PressableControl>
      )}
      {onLeaveFullScreen && (
        <PressableControl>
          <button
            type="button"
            className={LIVE_CONTROL}
            aria-label="Quitter le plein écran"
            onClick={onLeaveFullScreen}
          >
            <Minimize className="size-4" aria-hidden="true" />
          </button>
        </PressableControl>
      )}
    </div>
  )
}
