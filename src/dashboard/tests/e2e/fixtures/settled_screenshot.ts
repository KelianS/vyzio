import type { Page, PageScreenshotOptions } from '@playwright/test'

// Bounded so a motion that never rests fails the capture instead of hanging it.
const MAX_FRAMES = 600
// Three identical frames in a row: a spring moves its value on every frame until it rests.
const STILL_FRAMES = 3

/**
 * Waits until nothing moves on the page: every finite CSS or Web animation finished, then the inline
 * styles the springs write each frame (page, bar, ghost copies) unchanged over consecutive frames.
 */
async function waitForMotionToSettle(page: Page) {
  await page.evaluate(
    async ({ maxFrames, stillFrames }) => {
      const finite = () =>
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
      await Promise.all(finite().map((animation) => animation.finished.catch(() => undefined)))

      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
      const pose = () =>
        [...document.querySelectorAll('[style]')]
          .map((element) => element.getAttribute('style'))
          .join('|') + `|${finite().length}`
      let previous = pose()
      let still = 1
      for (let count = 0; count < maxFrames; count++) {
        await frame()
        const current = pose()
        still = current === previous ? still + 1 : 1
        if (still >= stillFrames) return
        previous = current
      }
      throw new Error(`The page was still moving after ${maxFrames} frames`)
    },
    { maxFrames: MAX_FRAMES, stillFrames: STILL_FRAMES },
  )
}

/** A viewport shot taken once the motion settled, so no image catches a page mid-transition (capture only). */
export async function settledScreenshot(
  page: Page,
  options: Pick<PageScreenshotOptions, 'path' | 'quality'>,
) {
  await waitForMotionToSettle(page)
  await page.screenshot(options)
}
