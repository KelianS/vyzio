import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

// How quickly a flick slows down once released, per millisecond: the rate a phone's own scroll uses.
const DECELERATION = 0.998
const RUBBER_BAND = 0.55
// How far a finger moves before its direction is read: a tap stays a tap.
const SLOP_PX = 10
// Only the last moments of a gesture tell its release velocity.
const VELOCITY_WINDOW_MS = 100

/** Where a flick released at `velocity`, in units per second, comes to rest beyond its release point. */
export function projection(velocity: number): number {
  return ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
}

/** How far a layer follows a finger pulling `over` past its end: ever harder, never past `dimension`. */
export function rubberBand(over: number, dimension: number): number {
  return (over * dimension * RUBBER_BAND) / (dimension + RUBBER_BAND * Math.abs(over))
}

/** The velocity of a value over the last moments it was moved, in units per second. */
class VelocityTracker {
  private samples: { time: number; value: number }[] = []

  add(value: number, time: number) {
    this.samples.push({ time, value })
    while (this.samples.length > 2 && time - this.samples[0].time > VELOCITY_WINDOW_MS)
      this.samples.shift()
  }

  velocity(now: number): number {
    const recent = this.samples.filter((sample) => now - sample.time <= VELOCITY_WINDOW_MS)
    if (recent.length < 2) return 0
    const first = recent[0]
    const last = recent[recent.length - 1]
    return (last.value - first.value) / Math.max(0.016, (last.time - first.time) / 1000)
  }
}

const OWN_DRAG = 'input, textarea, select, [role="slider"], [contenteditable="true"]'
const CONTROL = `${OWN_DRAG}, button, a, label, [role="button"], [role="switch"], [role="checkbox"], [data-press-only]`

/** A field or a slider: a drag that starts there belongs to it (DESIGN SYSTEM § Motion). */
export function holdsItsOwnDrag(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWN_DRAG) !== null
}

/** Any control, a steering pad's direction included: a drag that starts there is never a swipe. */
export function startsOnControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CONTROL) !== null
}

export type Axis = 'x' | 'y'

interface DragHandlers {
  /** Whether a finger put down on `target` may drag; one that may not is left to what it touched. */
  canStart?: (target: EventTarget | null) => boolean
  /** The direction is read and is this drag's: the layer is caught where it stands. */
  onStart: () => void
  /** The finger moved `offset` along the axis since the drag started. */
  onMove: (offset: number) => void
  /** The finger let go, `offset` along the axis from the start, at `velocity` units per second. */
  onEnd: (offset: number, velocity: number) => void
}

interface Session {
  pointerId: number
  x: number
  y: number
  base: number | null
  offset: number
  tracker: VelocityTracker
}

/**
 * A finger dragging along `axis`: it starts once the direction is read, follows one to one, and
 * hands over its release velocity. A mouse never drags: on a large screen, layers move by buttons.
 */
export function useFingerDrag(axis: Axis, handlers: DragHandlers) {
  const session = useRef<Session | null>(null)
  const dragged = useRef(false)
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })

  const end = (event: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const current = session.current
    if (!current || current.pointerId !== event.pointerId) return
    session.current = null
    if (current.base === null) return
    const now = performance.now()
    latest.current.onEnd(current.offset, cancelled ? 0 : current.tracker.velocity(now))
  }

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      dragged.current = false
      if (event.pointerType === 'mouse' || !event.isPrimary) return
      if (latest.current.canStart && !latest.current.canStart(event.target)) return
      session.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        base: null,
        offset: 0,
        tracker: new VelocityTracker(),
      }
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = session.current
      if (!current || current.pointerId !== event.pointerId) return
      const along = axis === 'x' ? event.clientX : event.clientY
      if (current.base === null) {
        const dx = event.clientX - current.x
        const dy = event.clientY - current.y
        if (Math.hypot(dx, dy) < SLOP_PX) return
        if ((Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') !== axis) {
          session.current = null
          return
        }
        current.base = along
        dragged.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        latest.current.onStart()
      }
      current.offset = along - current.base
      current.tracker.add(current.offset, performance.now())
      latest.current.onMove(current.offset)
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => end(event, false),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => end(event, true),
    // A drag that ends over a row or a link never also opens it.
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (!dragged.current) return
      dragged.current = false
      event.preventDefault()
      event.stopPropagation()
    },
  }
}
