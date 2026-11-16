import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeChannel,
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

/** A configured channel: its page sends a test message, and asks before removing it. */
async function openTheChannel(page: Page) {
  await installFakeBackend(
    page,
    createFakeBackendState({ notificationChannels: { telegram: makeFakeChannel('telegram') } }),
  )
  await page.goto('/settings/notifications/telegram')
}

async function sendATestMessage(page: Page) {
  await page.getByRole('button', { name: 'Envoyer un message de test' }).click()
  await expect(
    page.getByRole('region', { name: 'Notifications' }).getByRole('status'),
  ).toContainText('Message envoyé')
}

test.describe('Press feedback', () => {
  test.beforeEach(async ({ page }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
  })

  test('Button_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    await page.goto('/')

    expect(await pressed(page.getByRole('button', { name: 'Couper les caméras' }))).toEqual({
      scale: '0.97',
      opacity: '1',
    })
  })

  test('LiveControl_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    await page.goto('/cameras/camera-1')

    expect(await pressed(page.getByRole('button', { name: 'Retour' }))).toEqual({
      scale: '0.97',
      opacity: '1',
    })
  })

  test('JoystickArrow_ShouldShrinkSlightly_WhenItIsHeld', async ({ page }) => {
    const camera = makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'] })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
    await page.goto('/cameras/camera-1')

    expect(await pressed(page.getByTitle('Haut'))).toEqual({ scale: '0.97', opacity: '1' })
  })

  test('Button_ShouldDimInsteadOfShrinking_WhenThePhoneAsksForLessMotion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    expect(await pressed(page.getByRole('button', { name: 'Couper les caméras' }))).toEqual({
      scale: 'none',
      opacity: '0.8',
    })
  })
})

// Held with the pointer: headless Chromium sets no `:active` under an emulated finger.
test.describe('Press feedback on links and rows', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
  })

  test('CameraTile_ShouldDimWithoutMoving_WhenItIsPressed', async ({ page }) => {
    await page.goto('/')

    expect(await pressed(page.getByRole('link', { name: 'Salon' }))).toEqual({
      scale: 'none',
      opacity: '0.7',
    })
  })

  test('TopBarGear_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    await page.goto('/')

    expect(await pressed(page.getByRole('banner').getByRole('link', { name: 'Réglages' }))).toEqual(
      { scale: '0.97', opacity: '1' },
    )
  })

  test('CameraRow_ShouldDimWithoutMoving_WhenItIsPressed', async ({ page }) => {
    await page.goto('/settings/cameras')

    expect(await pressed(page.getByRole('link', { name: /Salon/ }))).toEqual({
      scale: 'none',
      opacity: '0.7',
    })
  })
})

// Every kind of row is the registry `item`: each one dims, links and buttons alike.
test.describe('Press feedback on every kind of row', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  const DIMMED = { scale: 'none', opacity: '0.7' }

  test('PersonRow_ShouldDimWithoutMoving_WhenItIsPressed', async ({ page }) => {
    const alice = {
      id: 'profile-1',
      name: 'Alice',
      category: 'family',
      alertMode: 'always',
      lastSeenAt: null,
      createdAt: '2026-11-01T08:00:00Z',
    }
    await installFakeBackend(page, createFakeBackendState({ profiles: [alice] }))
    await page.goto('/settings/detection/people')

    expect(await pressed(page.getByRole('link', { name: /Alice/ }))).toEqual(DIMMED)
  })

  test('ChannelRow_ShouldDimWithoutMoving_WhenItIsPressed', async ({ page }) => {
    const state = createFakeBackendState({
      notificationChannels: { telegram: makeFakeChannel('telegram') },
    })
    await installFakeBackend(page, state)
    await page.goto('/settings/notifications')

    expect(await pressed(page.getByRole('link', { name: /Telegram/ }))).toEqual(DIMMED)
  })

  test('AddChannelRow_ShouldDimWithoutMoving_WhenItIsPressed', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/notifications/add')

    expect(await pressed(page.getByRole('link', { name: /Telegram/ }))).toEqual(DIMMED)
  })

  test('SettingsRubricRow_ShouldDimWithoutMoving_WhenItIsPressed', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings')

    expect(
      await pressed(
        page
          .getByRole('navigation', { name: 'Rubriques de réglages' })
          .getByRole('link', { name: /Caméras/ }),
      ),
    ).toEqual(DIMMED)
  })

  test('DiscoveredCameraRow_ShouldDimWithoutMoving_WhenItIsPressed', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/settings/cameras/add')
    await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rechercher' }).click()

    expect(await pressed(page.getByRole('button', { name: /Caméra détectée/ }))).toEqual(DIMMED)
  })
})

// Every kind of control drawn without the button primitive presses like a button.
test.describe('Press feedback on every kind of control', () => {
  const SHRUNK = { scale: '0.97', opacity: '1' }

  test('ToastClose_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    await openTheChannel(page)
    await sendATestMessage(page)

    expect(
      await pressed(
        page
          .getByRole('region', { name: 'Notifications' })
          .getByRole('status')
          .getByRole('button', { name: 'Fermer' }),
      ),
    ).toEqual(SHRUNK)
  })

  test('AccessRetry_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.route('**/api/access/state', (route) => route.abort())
    await page.goto('/')
    await expect(page.getByText('Vyzio ne répond pas')).toBeVisible()

    expect(await pressed(page.getByRole('button', { name: 'Réessayer' }))).toEqual(SHRUNK)
  })

  test('DetectionTile_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ detectionHistory: [makeFakeDetectionEvent()] }),
    )
    await page.goto('/detections')

    expect(await pressed(page.getByRole('button', { name: /Voir l’aperçu/ }))).toEqual(SHRUNK)
  })

  test('PositionTile_ShouldShrinkSlightly_WhenItIsPressed', async ({ page }) => {
    const camera = makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'] })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
    await page.goto('/cameras/camera-1')

    expect(await pressed(page.getByTitle('Enregistrer la position actuelle ici').first())).toEqual(
      SHRUNK,
    )
  })

  test('LiveControl_ShouldDimInsteadOfShrinking_WhenThePhoneAsksForLessMotion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
    await page.goto('/cameras/camera-1')

    expect(await pressed(page.getByRole('button', { name: 'Retour' }))).toEqual({
      scale: 'none',
      opacity: '0.8',
    })
  })
})

test.describe('Layers', () => {
  test('ConfirmModal_ShouldFadeInGrowingSlightly_WhenItOpens', async ({ page }) => {
    await openTheChannel(page)
    await slowDownMotion(page)

    await page.getByRole('button', { name: 'Supprimer le canal' }).click()

    expect(await frameOf(page.getByRole('alertdialog'), 'first')).toEqual({
      opacity: 0,
      scale: 0.95,
    })
  })

  test('ConfirmModal_ShouldFadeOutShrinkingSlightly_WhenItCloses', async ({ page }) => {
    await openTheChannel(page)
    await page.getByRole('button', { name: 'Supprimer le canal' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await slowDownMotion(page)

    await dialog.getByRole('button', { name: 'Annuler' }).click()

    expect(await frameOf(dialog, 'last')).toEqual({ opacity: 0, scale: 0.95 })
  })

  test('ConfirmModal_ShouldFadeOutShrinkingSlightly_WhenTheConfirmedActionSettles', async ({
    page,
  }) => {
    await openTheChannel(page)
    await page.getByRole('button', { name: 'Supprimer le canal' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await slowDownMotion(page)

    await dialog.getByRole('button', { name: 'Supprimer' }).click()
    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByRole('status'),
    ).toContainText('Canal supprimé.')

    // Leaving after its action, it is a copy hidden from assistive technologies.
    const leaving = page.locator('[data-slot="alert-dialog-content"][data-state="closed"]')
    expect(await frameOf(leaving, 'last')).toEqual({ opacity: 0, scale: 0.95 })
  })

  test('HelpPopover_ShouldFadeInGrowingSlightly_WhenItOpens', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connection')
    const stream = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem').first()
    await stream.getByText('Options').click()
    await slowDownMotion(page)

    await stream
      .getByRole('listitem', { name: '1920 × 1080 · 15 img/s' })
      .getByRole('button', { name: 'Comment Vyzio reçoit-il ce flux ?' })
      .click()

    expect(await frameOf(page.getByRole('dialog'), 'first')).toEqual({ opacity: 0, scale: 0.95 })
  })

  test('Select_ShouldFadeInGrowingSlightly_WhenItOpens', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/settings/cameras/add')
    await page.getByRole('button', { name: 'Saisir l’adresse moi-même' }).click()
    await slowDownMotion(page)

    await page.getByRole('combobox', { name: 'Marque' }).click()

    expect(await frameOf(page.getByRole('listbox'), 'first')).toEqual({ opacity: 0, scale: 0.95 })
  })

  test('Overlay_ShouldOnlyFade_WhenItOpens', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ detectionHistory: [makeFakeDetectionEvent()] }),
    )
    await page.goto('/detections')
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
    await page.goto('/detections')
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
    await openTheChannel(page)
    await slowDownMotion(page)

    await page.getByRole('button', { name: 'Supprimer le canal' }).click()

    expect(await frameOf(page.getByRole('alertdialog'), 'first')).toEqual({
      opacity: 0,
      scale: 1,
    })
  })
})

test.describe('Toasts', () => {
  test.beforeEach(async ({ page }) => {
    await openTheChannel(page)
  })

  test('Toast_ShouldFadeInRisingSlightly_WhenItAppears', async ({ page }) => {
    await recordToastEntrances(page)

    await sendATestMessage(page)

    expect(await toastEntrances(page)).toEqual([expect.arrayContaining(['opacity', 'translate'])])
  })

  test('Toast_ShouldOnlyFadeIn_WhenThePhoneAsksForLessMotion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await recordToastEntrances(page)

    await sendATestMessage(page)

    expect(await toastEntrances(page)).toEqual([['opacity']])
  })

  test('Toast_ShouldFadeOut_WhenTheUserClosesIt', async ({ page }) => {
    await sendATestMessage(page)
    const toast = page.getByRole('region', { name: 'Notifications' }).getByRole('status')
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
