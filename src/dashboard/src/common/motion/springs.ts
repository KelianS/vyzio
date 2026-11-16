import { animate, type MotionValue } from 'motion/react'

/** A spring named by how fast it reaches its target and how much it overshoots, as a damping ratio. */
function spring(responseSeconds: number, dampingRatio: number) {
  const stiffness = ((2 * Math.PI) / responseSeconds) ** 2
  return {
    type: 'spring',
    stiffness,
    damping: 2 * dampingRatio * Math.sqrt(stiffness),
    mass: 1,
  } as const
}

/** The springs of DESIGN SYSTEM § Motion: what arrives bounces lightly, what leaves settles without a bounce. */
export type SpringKind = 'arrival' | 'departure' | 'press'

const SPRINGS: Record<SpringKind, ReturnType<typeof spring>> = {
  arrival: spring(0.4, 0.74),
  departure: spring(0.35, 1),
  press: spring(0.12, 1),
}

// Brief and bounce-free whatever it replaces: under reduced motion nothing overshoots.
const REDUCED = spring(0.15, 1)

/** How much a pressed control sinks, and how dark a page receding under another turns. */
export const PRESSED_SCALE = 0.96
export const RECEDED_DIM = 0.35
/** How far a receding page drifts, as a share of its width, and how far the bar's contents travel. */
export const RECEDED_SHIFT = 0.28
export const BAR_SWAP_SHIFT = 16

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** Whether the phone asks for less motion, read at the moment of asking. */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCE_QUERY).matches
}

/** The spring of `kind`, or the brief bounce-free one when the phone asks for less motion. */
function springOf(kind: SpringKind) {
  return prefersReducedMotion() ? REDUCED : SPRINGS[kind]
}

/**
 * Springs `value` to `target` from where it stands, keeping its velocity unless a gesture hands its
 * own over: a motion caught mid-flight goes on without a jump.
 */
export function springTo(
  value: MotionValue<number>,
  target: number,
  kind: SpringKind,
  velocity?: number,
) {
  return animate(
    value,
    target,
    velocity === undefined ? springOf(kind) : { ...springOf(kind), velocity },
  )
}
