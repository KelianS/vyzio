import { useState, type PointerEvent } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, type LucideIcon } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import { PressableControl } from '../../../common/components/pressable'
import type { PtzDirection } from '../live_view.uido'

/** In the page, or laid over the picture, translucent (DESIGN SYSTEM § Steering pad). */
export type PadVariant = 'solid' | 'glass'

const PAD: Record<PadVariant, { ring: string; centre: string; vertical: string; side: string }> = {
  solid: {
    ring: 'size-40 bg-card',
    centre: 'size-11 bg-secondary',
    vertical: 'h-13 w-12',
    side: 'h-12 w-13',
  },
  glass: {
    ring: 'size-37.5 bg-glass',
    centre: 'size-10 bg-glass',
    vertical: 'size-12.5',
    side: 'size-12.5',
  },
}

const ZONES: {
  direction: PtzDirection
  title: string
  icon: LucideIcon
  place: string
  vertical: boolean
}[] = [
  {
    direction: 'Up',
    title: 'Haut',
    icon: ChevronUp,
    place: 'top-0 left-1/2 -translate-x-1/2',
    vertical: true,
  },
  {
    direction: 'Left',
    title: 'Gauche',
    icon: ChevronLeft,
    place: 'left-0 top-1/2 -translate-y-1/2',
    vertical: false,
  },
  {
    direction: 'Right',
    title: 'Droite',
    icon: ChevronRight,
    place: 'right-0 top-1/2 -translate-y-1/2',
    vertical: false,
  },
  {
    direction: 'Down',
    title: 'Bas',
    icon: ChevronDown,
    place: 'bottom-0 left-1/2 -translate-x-1/2',
    vertical: true,
  },
]

/** The one round pad that steers a camera (#389): a direction moves while held, and stops on release. */
export function PtzPad({
  variant,
  onPress,
  onRelease,
}: {
  variant: PadVariant
  onPress: (direction: PtzDirection) => void
  onRelease: () => void
}) {
  const [held, setHeld] = useState<PtzDirection | null>(null)
  const pad = PAD[variant]

  const release = () => {
    setHeld(null)
    onRelease()
  }

  // Pointer events only, captured: a touch also emulates mouse events, which would send a second move.
  const zone = (direction: PtzDirection) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      setHeld(direction)
      onPress(direction)
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
  })

  return (
    <div
      role="group"
      aria-label="Orienter la caméra"
      data-press-only
      className={cn('relative shrink-0 touch-none rounded-full', pad.ring)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full',
          pad.centre,
        )}
      />
      {ZONES.map(({ direction, title, icon: Icon, place, vertical }) => (
        <PressableControl key={direction}>
          <button
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={held === direction}
            {...zone(direction)}
            className={cn(
              'absolute flex items-center justify-center rounded-full text-ink-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'aria-pressed:bg-icon-circle aria-pressed:text-foreground',
              vertical ? pad.vertical : pad.side,
              place,
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
          </button>
        </PressableControl>
      ))}
    </div>
  )
}
