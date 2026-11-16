import { vi } from 'vitest'
import { MotionGlobalConfig } from 'motion/react'

/** The phone asks for no less motion, and springs take their real time: for a test of motion itself. */
export function withFullMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  MotionGlobalConfig.instantAnimations = false
}
