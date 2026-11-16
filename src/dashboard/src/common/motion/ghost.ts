import type { MotionValue } from 'motion/react'

/**
 * A lifeless copy of `element`, laid over the page at `layer` where it stands once its translation
 * (`x`, `y`) is taken off, for the last movement of what React replaces: hidden from assistive
 * technologies, it loads no media again.
 */
export function ghostOf(element: HTMLElement, layer: number, x = 0, y = 0): HTMLElement {
  const box = element.getBoundingClientRect()
  const ghost = element.cloneNode(true) as HTMLElement
  for (const node of [ghost, ...ghost.querySelectorAll('[id]')]) node.removeAttribute('id')
  for (const media of ghost.querySelectorAll('video, audio, iframe')) {
    media.removeAttribute('src')
    media.replaceChildren()
  }
  ghost.setAttribute('aria-hidden', 'true')
  ghost.setAttribute('inert', '')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${box.left - x}px`,
    top: `${box.top - y}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: '0',
    zIndex: String(layer),
    pointerEvents: 'none',
    transform: '',
  })
  document.body.append(ghost)
  return ghost
}

/** Calls `paint` now and whenever one of `values` changes; returns the unsubscription. */
export function paintOn(values: readonly MotionValue<number>[], paint: () => void): () => void {
  paint()
  const stops = values.map((value) => value.on('change', paint))
  return () => stops.forEach((stop) => stop())
}

/** A translation, or none at rest: a transformed ancestor would trap a full-screen picture inside it. */
export function translation(x: number, y: number): string {
  return x === 0 && y === 0 ? '' : `translate3d(${x}px, ${y}px, 0)`
}
