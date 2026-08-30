import { test, expect, type Page } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeDetectionEvent as makeEvent,
} from './fixtures/fakeBackend'

/**
 * The defects found in use after the `config-ui` batch (see `docs/BACKLOG.md`, batch
 * `ui-defauts`). Each one is reproduced here before being fixed.
 */

test.describe('Mettre une caméra en pause', () => {
  test('user_When pausing one camera_Should confirm, wait, then say it happened', async ({
    page,
  }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/')
    await page.getByRole('button', { name: 'Pause' }).click()

    // Cutting one camera costs as much as all of them: the request announces itself alike.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Mettre « Salon » en pause ?')
    await expect(dialog).toContainText('Plus rien n’est enregistré ni signalé par cette caméra')
    await dialog.getByRole('button', { name: 'Mettre en pause' }).click()

    // And the result is said: without that, nothing tells a long operation from a failed one.
    await expect(page.getByRole('status')).toContainText('Salon est en pause.')
    await expect(page.getByRole('button', { name: 'Réactiver' })).toBeVisible()
  })
})

test.describe('Vue live', () => {
  test('user_When viewing a camera live_Should be able to close with a visible cross', async ({
    page,
  }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/')
    await page.getByRole('button', { name: 'Salon' }).click()

    const overlay = page.getByRole('dialog', { name: 'Aperçu' })
    await expect(overlay).toBeVisible()

    // Clicking outside already closed it; nothing announced it, and the content covered the cross.
    const close = overlay.getByRole('button', { name: 'Fermer' })
    await expect(close).toBeVisible()
    await close.click()

    await expect(overlay).toBeHidden()
  })

  test('user_When the stream is unavailable_Should see waiting, never a broken image', async ({
    page,
  }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
    // What a surveillance restart does: the image does not arrive.
    await page.route('**/live/latest.jpg**', (route) => route.abort())

    await page.goto('/')

    await expect(page.getByText('Reconnexion…').first()).toBeVisible()
    // An image with no data carries the browser's broken icon: it must not show through.
    await expect(page.locator('article img')).not.toBeVisible()
    // And the thumbnail stays openable: hiding the image must not take its name away.
    await expect(page.getByRole('button', { name: 'Salon' })).toBeVisible()
  })
})

test.describe('Positions PTZ, depuis la vue live', () => {
  async function openLive(
    page: Page,
    ptz: Partial<ReturnType<typeof createFakeBackendState>['ptz']> = {},
  ) {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ id: 'camera-1', displayName: 'Salon', ptzSupported: true })],
    })
    state.ptz = { ...state.ptz, ...ptz }
    await installFakeBackend(page, state)

    await page.goto('/')
    await page.getByRole('button', { name: 'Salon' }).click()
    return state
  }

  test('user_When no position is saved yet_Should save the first one with a plain tap', async ({
    page,
  }) => {
    const state = await openLive(page)

    // The long press is the overwrite gesture; there is nothing to overwrite.
    await page.getByTitle('Enregistrer la position actuelle ici').first().click()

    await expect(page.getByRole('status')).toContainText('enregistrée')
    expect(state.ptz.presets).toHaveLength(1)
  })

  test('user_When going to a position_Should be told, and see where the camera stands', async ({
    page,
  }) => {
    await openLive(page, {
      presets: [
        {
          presetId: 1,
          label: 'Surveillance',
          native: false,
          stepsX: 4,
          stepsY: 2,
          configured: true,
        },
      ],
      currentPosition: { x: 0, y: 0 },
    })

    const tile = page.getByTitle(/Surveillance — appui/)
    await expect(tile).toHaveAttribute('aria-pressed', 'false')

    await tile.click()

    // A move takes time: without an acknowledgement, the press looks like it did nothing.
    await expect(page.getByRole('status')).toContainText('Caméra en position « Surveillance ».')
    await expect(tile).toHaveAttribute('aria-pressed', 'true')
  })

  test('user_When the camera has no reference_Should be told why, and able to fix it there', async ({
    page,
  }) => {
    const state = await openLive(page, { calibrated: false, currentPosition: null })

    await expect(page.getByText(/pas de position de référence/)).toBeVisible()

    await page.getByRole('button', { name: 'Calibrer maintenant' }).click()
    await expect(page.getByRole('status')).toContainText('Caméra calibrée')
    expect(state.ptz.calibrated).toBe(true)

    // And the positions become usable again without going through the settings.
    await page.getByTitle('Enregistrer la position actuelle ici').first().click()
    await expect(page.getByRole('status').last()).toContainText('enregistrée')
  })
})

test.describe('Historique', () => {
  async function openHistory(page: Page) {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [makeEvent(), makeEvent({ eventId: 'event-2' })],
      }),
    )
    await page.goto('/history')
  }

  test('user_When opening history_Should see detections, filters folded away', async ({ page }) => {
    await openHistory(page)

    await expect(page.getByRole('heading', { name: 'Historique' })).toBeVisible()

    // What one comes to read here is the detections - not a filter form.
    await expect(page.getByRole('region', { name: 'Filtres' })).toBeHidden()
    await page.getByRole('button', { name: 'Filtrer' }).click()
    await expect(page.getByRole('region', { name: 'Filtres' })).toBeVisible()
  })

  test('user_When comparing history to home_Should see the same detection rows', async ({
    page,
  }) => {
    await openHistory(page)

    // The home thumbnail was missing here, although it is the same list.
    const preview = page.getByRole('button', { name: /Voir l’aperçu/ }).first()
    await expect(preview).toBeVisible()
    await expect(preview.locator('img')).toBeAttached()

    await expect(page.getByText(/front door · .* · 92 % de certitude/).first()).toBeVisible()
  })

  test('user_When a detection carries no identity_Should not be asked who it was', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [makeEvent(), makeEvent({ eventId: 'event-2', label: 'cat' })],
      }),
    )
    await page.goto('/history')

    // Only person detections carry an identity (person_known/person_unknown).
    await expect(page.getByRole('button', { name: 'Identifier' })).toHaveCount(1)
  })
})
