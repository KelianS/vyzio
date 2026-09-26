import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

test.describe('Accueil — couper la surveillance', () => {
  test('user_When cutting every camera_Should confirm, then see the page say so', async ({
    page,
  }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon', isEnabled: true })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/')

    // Home says first what is being watched - that is what one comes to check.
    await expect(page.getByRole('heading', { name: '1 caméra sous surveillance' })).toBeVisible()
    await expect(page.getByText('Salon')).toBeVisible()

    await page.getByRole('button', { name: 'Tout couper' }).click()

    // The cost is said beforehand: nothing more is recorded nor reported.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Plus rien n’est enregistré ni signalé')
    await dialog.getByRole('button', { name: 'Tout couper' }).click()

    await expect(page.getByRole('heading', { name: 'Surveillance coupée' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reprendre la surveillance' })).toBeVisible()
  })

  test('CameraLiveThumbnail_ShouldLeadToWhy_WhenTheCameraDidNotFollowPrivacy', async ({ page }) => {
    const parked = makeFakeCamera({
      id: 'camera-1',
      displayName: 'Salon',
      privacyModeActive: true,
      privacyModeSource: 'manual',
      privacyStrategy: 'ptz_parking',
      ptzSupported: true,
      privacyMiss: 'camera_failed',
      privacyMissDetail:
        'privacy on, ptz_parking: CameraUnreachableException: ONVIF Ptz: no answer',
    })
    const watching = makeFakeCamera({ id: 'camera-2', slug: 'jardin', displayName: 'Jardin' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [parked, watching] }))

    await page.goto('/')
    await page.getByRole('link', { name: 'La caméra n’a pas suivi' }).click()

    await expect(page).toHaveURL(/\/settings\/cameras\/camera-1\/vie-privee$/)
    await expect(page.getByText('La caméra n’a pas suivi, enregistrement désactivé')).toBeVisible()
    await expect(page.getByRole('status')).toContainText(
      'ne s’est pas tournée vers sa position Parking',
    )
    await expect(page.getByRole('status')).toContainText('ONVIF Ptz: no answer')
  })
})
