import { fireEvent } from '@testing-library/react'

const TOUCH = { pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0 }

/** A finger put down on `element` at (`x`, `y`). */
export function touchDown(element: Element, x: number, y: number) {
  fireEvent.pointerDown(element, { ...TOUCH, clientX: x, clientY: y })
}

/** The finger moved to (`x`, `y`), over `element` or whatever holds its capture. */
export function touchMove(element: Element, x: number, y: number) {
  fireEvent.pointerMove(element, { ...TOUCH, clientX: x, clientY: y })
}

/** The finger lifted at (`x`, `y`). */
export function touchUp(element: Element, x: number, y: number) {
  fireEvent.pointerUp(element, { ...TOUCH, clientX: x, clientY: y })
}

/** Lets the last moves age past the window a release velocity is read from: a slow, still release. */
export function holdStill() {
  return new Promise((resolve) => setTimeout(resolve, 150))
}

/** Gives every element `height` and `width` pixels, which jsdom never lays out. */
export function layOut(width: number, height: number): () => void {
  const sizes = { offsetHeight: height, offsetWidth: width }
  const kept = Object.keys(sizes).map((name) => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get: () => sizes[name as keyof typeof sizes],
    })
    return () => original && Object.defineProperty(HTMLElement.prototype, name, original)
  })
  return () => kept.forEach((restore) => restore())
}
