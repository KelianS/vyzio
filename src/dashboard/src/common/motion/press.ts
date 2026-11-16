import { motionValue, type MotionValue } from 'motion/react'
import { PRESSED_SCALE, prefersReducedMotion, springTo } from './springs'

// A control is taken by its slot, never by a class on a screen (DESIGN SYSTEM § Motion).
const CONTROL = '[data-slot="button"], [data-slot="pressable-control"]'

const scales = new WeakMap<HTMLElement, MotionValue<number>>()

function scaleOf(control: HTMLElement): MotionValue<number> {
  let scale = scales.get(control)
  if (!scale) {
    const created = motionValue(1)
    created.on('change', (value) => {
      control.style.scale = value === 1 ? '' : String(value)
    })
    scales.set(control, created)
    scale = created
  }
  return scale
}

function controlUnder(target: EventTarget | null): HTMLElement | null {
  const control = target instanceof Element ? target.closest<HTMLElement>(CONTROL) : null
  return control && !control.matches(':disabled') ? control : null
}

/**
 * Every control of `root` sinks on pointer-down and springs back once released; under reduced
 * motion the stylesheet dims it instead. Returns the uninstallation.
 */
export function installPressFeedback(root: Document): () => void {
  const press = (event: PointerEvent) => {
    if (event.button !== 0 || prefersReducedMotion()) return
    const control = controlUnder(event.target)
    if (!control) return
    const scale = scaleOf(control)
    void springTo(scale, PRESSED_SCALE, 'press')
    const release = () => {
      root.removeEventListener('pointerup', release, true)
      root.removeEventListener('pointercancel', release, true)
      control.removeEventListener('pointerleave', release)
      void springTo(scale, 1, 'arrival')
    }
    root.addEventListener('pointerup', release, true)
    root.addEventListener('pointercancel', release, true)
    control.addEventListener('pointerleave', release)
  }
  root.addEventListener('pointerdown', press, true)
  return () => root.removeEventListener('pointerdown', press, true)
}
