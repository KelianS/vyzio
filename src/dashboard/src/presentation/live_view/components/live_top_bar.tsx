import type { ReactNode } from 'react'
import { ArrowLeft, Maximize } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import { fading, LIVE_CONTROL } from './live_control'

/** The bar over the picture: back, the camera's name, then the picture's own controls (DESIGN SYSTEM § Full-screen viewing). */
export function LiveTopBar({
  label,
  shown,
  onBack,
  onFullScreen,
  children,
}: {
  label: string
  shown: boolean
  onBack: () => void
  /** Given only while the browser can still be asked to hide its bars. */
  onFullScreen?: () => void
  children?: ReactNode
}) {
  const fade = fading(shown)

  return (
    <div
      {...fade}
      className={cn(
        'absolute inset-x-0 top-0 flex items-center gap-2 bg-linear-to-b from-surface-inverse/80 to-transparent pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-6 pl-[max(0.5rem,env(safe-area-inset-left))] text-surface-inverse-foreground',
        fade.className,
      )}
    >
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
      <p className="min-w-0 flex-1 truncate font-medium">{label}</p>
      {children}
      {onFullScreen && (
        <button
          type="button"
          className={LIVE_CONTROL}
          aria-label="Plein écran"
          onClick={onFullScreen}
        >
          <Maximize className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
