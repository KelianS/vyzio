import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

/** Runs every animation of the page a hundred times slower, so a 200ms fade can be looked at. */
async function slowDownMotion(page: Page) {
  const devtools = await page.context().newCDPSession(page)
  await devtools.send('Animation.enable')
  await devtools.send('Animation.setPlaybackRate', { playbackRate: 0.01 })
}

/** How a layer looks on the first or the last frame of the animation it is playing. */
async function frameOf(layer: Locator, at: 'first' | 'last') {
  return layer.evaluate((el, at) => {
    const [animation] = el.getAnimations()
    animation.pause()
    const end = Number(animation.effect?.getComputedTiming().endTime)
    animation.currentTime = at === 'first' ? 0 : end - 1
    const style = getComputedStyle(el)
    return {
      opacity: Math.round(Number(style.opacity) * 100) / 100,
      scale: Math.round(new DOMMatrix(style.transform).a * 100) / 100,
    }
  }, at)
}

/** The scale and opacity of a control while a finger holds it down. */
async function pressed(control: Locator) {
  const box = await control.boundingBox()
  await control.page().mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await control.page().mouse.down()
  await control.page().waitForTimeout(300)
  return control.evaluate((el) => ({
    scale: getComputedStyle(el).scale,
    opacity: getComputedStyle(el).opacity,
  }))
}

/** Records the transitions each toast starts with: its entrance is over before a locator could look. */
async function recordToastEntrances(page: Page) {
  await page.evaluate(() => {
    const record = window as unknown as { toastEntrances: string[][] }
    record.toastEntrances = []
    new MutationObserver((mutations) => {
      for (const node of mutations.flatMap((mutation) => [...mutation.addedNodes])) {
        if (node instanceof HTMLElement && node.parentElement?.ariaLabel === 'Notifications') {
          record.toastEntrances.push(
            node
              .getAnimations()
              .map((animation) => (animation as CSSTransition).transitionProperty),
          )
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  })
}

async function toastEntrances(page: Page) {
  return page.evaluate(() => (window as unknown as { toastEntrances: string[][] }).toastEntrances)
}

async function pauseTheCamera(page: Page) {
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Mettre en pause' }).click()
  await expect(page.getByRole('status')).toContainText('Salon est en pause.')
}

test.describe('Press feedback', () => {
  test.beforeEach(async ({ page }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
  })

  test('Button_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    await page.goto('/')

    expect(await pressed(page.getByRole('button', { name: 'Pause' }))).toEqual({
      scale: '0.97',
      opacity: '1',
    })
  })

  test('LiveControl_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    await page.goto('/cameras/camera-1/direct')

    expect(await pressed(page.getByRole('button', { name: 'Retour' }))).toEqual({
      scale: '0.97',
      opacity: '1',
    })
  })

  test('Button_ShouldDimInsteadOfShrinking_WhenThePhoneAsksForLessMotion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    expect(await pressed(page.getByRole('button', { name: 'Pause' }))).toEqual({
      scale: 'none',
      opacity: '0.8',
    })
  })
})

test.describe('Layers', () => {
  test('ConfirmModal_ShouldFadeInGrowingSlightly_WhenItOpens', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')
    await slowDownMotion(page)

    await page.getByRole('button', { name: 'Pause' }).click()

    expect(await frameOf(page.getByRole('alertdialog'), 'first')).toEqual({
      opacity: 0,
      scale: 0.95,
    })
  })

  test('ConfirmModal_ShouldFadeOutShrinkingSlightly_WhenItCloses', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Pause' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await slowDownMotion(page)

    await dialog.getByRole('button', { name: 'Annuler' }).click()

    expect(await frameOf(dialog, 'last')).toEqual({ opacity: 0, scale: 0.95 })
  })

  test('HelpPopover_ShouldFadeInGrowingSlightly_WhenItOpens', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
    const stream = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem').first()
    await stream.getByText('Options').click()
    await slowDownMotion(page)

    await stream
      .getByRole('listitem', { name: '1920 × 1080 · 15 img/s' })
      .getByRole('button', { name: 'Comment Vyzio reçoit-il ce flux ?' })
      .click()

    expect(await frameOf(page.getByRole('dialog'), 'first')).toEqual({ opacity: 0, scale: 0.95 })
  })

  test('Overlay_ShouldOnlyFade_WhenItOpens', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ detectionHistory: [makeFakeDetectionEvent()] }),
    )
    await page.goto('/history')
    await slowDownMotion(page)

    await page.getByRole('button', { name: /Voir l’aperçu/ }).click()

    expect(
      await frameOf(page.getByRole('dialog', { name: 'Aperçu de la détection' }), 'first'),
    ).toEqual({ opacity: 0, scale: 1 })
  })

  test('Overlay_ShouldOnlyFade_WhenItCloses', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ detectionHistory: [makeFakeDetectionEvent()] }),
    )
    await page.goto('/history')
    await page.getByRole('button', { name: /Voir l’aperçu/ }).click()
    const viewer = page.getByRole('dialog', { name: 'Aperçu de la détection' })
    await expect(viewer).toBeVisible()
    await expect.poll(() => viewer.evaluate((el) => el.getAnimations().length)).toBe(0)
    await slowDownMotion(page)

    await viewer.getByRole('button', { name: 'Fermer' }).first().click()

    expect(await frameOf(viewer, 'last')).toEqual({ opacity: 0, scale: 1 })
  })

  test('ConfirmModal_ShouldOnlyFade_WhenThePhoneAsksForLessMotion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')
    await slowDownMotion(page)

    await page.getByRole('button', { name: 'Pause' }).click()

    expect(await frameOf(page.getByRole('alertdialog'), 'first')).toEqual({
      opacity: 0,
      scale: 1,
    })
  })
})

test.describe('Toasts', () => {
  test.beforeEach(async ({ page }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
  })

  test('Toast_ShouldFadeInRisingSlightly_WhenItAppears', async ({ page }) => {
    await page.goto('/')
    await recordToastEntrances(page)

    await pauseTheCamera(page)

    expect(await toastEntrances(page)).toEqual([expect.arrayContaining(['opacity', 'translate'])])
  })

  test('Toast_ShouldOnlyFadeIn_WhenThePhoneAsksForLessMotion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await recordToastEntrances(page)

    await pauseTheCamera(page)

    expect(await toastEntrances(page)).toEqual([['opacity']])
  })

  test('Toast_ShouldFadeOut_WhenTheUserClosesIt', async ({ page }) => {
    await page.goto('/')
    await pauseTheCamera(page)
    const toast = page.getByRole('status')
    await expect.poll(() => toast.evaluate((el) => el.getAnimations().length)).toBe(0)
    await slowDownMotion(page)

    await toast.getByRole('button', { name: 'Fermer' }).click()

    expect(
      await toast.evaluate((el) =>
        el.getAnimations().map((animation) => (animation as CSSTransition).transitionProperty),
      ),
    ).toEqual(['opacity'])
  })
})
