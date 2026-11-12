import { describe, expect, it, vi } from 'vitest'
import { whenStill } from './layer_exit'

/** An element playing one animation that ends with `finished`. */
function playing(finished: Promise<unknown>): Element {
  return { getAnimations: () => [{ finished }] } as unknown as Element
}

describe('whenStill', () => {
  it('whenStill_ShouldHandBackAtOnce_WhenTheLayerIsAlreadyGone', () => {
    // Arrange
    const done = vi.fn()

    // Act
    whenStill(null, done)

    // Assert
    expect(done).toHaveBeenCalledOnce()
  })

  it('whenStill_ShouldWaitForTheFade_WhenTheLayerIsStillPlayingIt', async () => {
    // Arrange
    const done = vi.fn()

    // Act
    whenStill(playing(new Promise(() => undefined)), done)
    await new Promise((resolve) => setTimeout(resolve))

    // Assert
    expect(done).not.toHaveBeenCalled()
  })

  it('whenStill_ShouldHandBack_WhenTheFadeHasPlayed', async () => {
    // Arrange
    const done = vi.fn()

    // Act
    whenStill(playing(Promise.resolve()), done)
    await new Promise((resolve) => setTimeout(resolve))

    // Assert
    expect(done).toHaveBeenCalledOnce()
  })

  it('whenStill_ShouldNeverHandBack_WhenItIsCancelledBeforeTheFadeEnds', async () => {
    // Arrange
    let endFade = () => {}
    const done = vi.fn()
    const cancel = whenStill(playing(new Promise<void>((resolve) => (endFade = resolve))), done)

    // Act
    cancel()
    endFade()
    await new Promise((resolve) => setTimeout(resolve))

    // Assert
    expect(done).not.toHaveBeenCalled()
  })
})
