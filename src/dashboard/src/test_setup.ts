import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MotionGlobalConfig } from 'motion/react'

// jsdom lays nothing out, so it has no scrollIntoView, which Radix Select calls on open.
Element.prototype.scrollIntoView ??= () => undefined

// Nor pointer capture, which the joystick takes so a press ends where it started.
Element.prototype.setPointerCapture ??= () => undefined

// Nor ResizeObserver, which Radix Slider measures its thumb with.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Nor media queries: the suite runs as a phone asking for less motion, as the e2e suite does;
// a test of the full motion asks for it (`src/testing/full_motion.ts`).
window.matchMedia ??= (query: string) =>
  ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as MediaQueryList

// Every spring lands on the next frame, so a test reads where a motion ends without waiting for it.
MotionGlobalConfig.instantAnimations = true

afterEach(() => {
  MotionGlobalConfig.instantAnimations = true
  // A lifeless copy still leaving when its test ends never haunts the next one.
  document.body.querySelectorAll(':scope > [inert]').forEach((copy) => copy.remove())
  cleanup()
  // What a device keeps (a dismissed alert) never leaks from one test into the next.
  localStorage.clear()
})
