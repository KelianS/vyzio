import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * A page is named **once only**.
 *
 * Every level had ended up saying the same word again: the "Vie privee" tab, the
 * "Vie privee" frame, then the legacy section - three identical titles for one
 * single setting. These tests hold the rule, because it gets lost again with every
 * screen added: putting up a titled frame is the spontaneous gesture.
 */
const CAMERA_TABS = [
  ['detection', 'Détection'],
  ['conservation', 'Conservation'],
  ['vie-privee', 'Vie privée'],
  ['image', 'Image et pilotage'],
  ['connexion', 'Connexion'],
] as const

test.describe('Hiérarchie — une page se nomme une fois', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['image_settings'] })],
      }),
    )
  })

  for (const [slug, label] of CAMERA_TABS) {
    test(`camera_When opening the ${slug} tab_Should not repeat the tab name as a heading`, async ({
      page,
    }) => {
      await page.goto(`/settings/cameras/camera-1/${slug}`)

      // The active tab already names the page, and it stays visible above it.
      const tabs = page.getByRole('navigation', { name: 'Réglages de la caméra' })
      await expect(tabs.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(page.getByRole('heading', { name: label })).toHaveCount(0)
    })
  }

  test('camera_When opening a camera_Should be named by the camera, not by its rubric', async ({
    page,
  }) => {
    // On a small screen the section menu goes away: all that is left are the
    // landmarks the page gives itself.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/settings/cameras/camera-1/detection')

    await expect(page.getByRole('heading', { name: 'Porte d’entrée' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Caméras' })).toHaveCount(0)

    // One back link only, the one of the page - the top bar aside. Two stacked
    // arrows no longer say which one leads where.
    await expect(page.getByRole('link', { name: 'Caméras', exact: true })).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Réglages', exact: true })).toHaveCount(1)
  })

  test('rubric_When opening a rubric page on a phone_Should still be named once', async ({
    page,
  }) => {
    // The section menu gives way to the page: without this title, the screen
    // would have nothing left to name itself.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/settings/conservation')

    await expect(page.getByRole('heading', { name: 'Conservation', level: 1 })).toHaveCount(1)
  })
})
