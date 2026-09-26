import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom lays nothing out, so it has no scrollIntoView, which Radix Select calls on open.
Element.prototype.scrollIntoView ??= () => undefined

// Nor ResizeObserver, which Radix Slider measures its thumb with.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
})
