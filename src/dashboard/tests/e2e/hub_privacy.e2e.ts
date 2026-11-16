import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

test.describe('HubView privacy', () => {
  test('CameraEye_ShouldCutThenResumeTheCameraWithoutAsking_WhenTheUserTapsIt', async ({
    page,
  }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/')
    await page.getByRole('button', { name: 'Couper Salon' }).click()

    // No question asked: the card itself says it at once (PRIV-21, PRIV-20).
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    const card = page.getByRole('article')
    await expect(card.getByText('Coupée')).toBeVisible()
    await expect(card.getByRole('img', { name: 'Coupée' })).toBeVisible()

    await page.getByRole('button', { name: 'Réactiver Salon' }).click()
    await expect(card.getByRole('img', { name: 'En marche' })).toBeVisible()
  })

  test('CutCameras_ShouldCutEveryCameraThenOfferToResumeThem_WhenTheUserTapsIt', async ({
    page,
  }) => {
    const salon = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    const jardin = makeFakeCamera({ id: 'camera-2', slug: 'jardin', displayName: 'Jardin' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon, jardin] }))

    await page.goto('/')
    await page.getByRole('button', { name: 'Couper les caméras' }).click()

    await expect(page.getByRole('button', { name: 'Réactiver les caméras' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Coupée' })).toHaveCount(2)
  })

  test('CameraPrivacyView_ShouldSayUntilWhenTheSurveillanceIsResumed_WhenItWasResumedInsideARange', async ({
    page,
  }) => {
    const resumed = makeFakeCamera({
      id: 'camera-1',
      displayName: 'Salon',
      privacyResume: { until: { dayOfWeek: 2, time: '12:00' } },
    })
    await installFakeBackend(page, createFakeBackendState({ cameras: [resumed] }))

    await page.goto('/settings/cameras/camera-1/privacy')

    await expect(
      page.getByText(
        'Surveillance reprise jusqu’à la fin de la plage, mardi à 12:00, heure de la maison.',
      ),
    ).toBeVisible()
  })

  test('CameraCard_ShouldLeadToWhy_WhenTheCameraDidNotFollowPrivacy', async ({ page }) => {
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
    await page.getByRole('link', { name: 'La caméra ne s’est pas tournée' }).click()

    await expect(page).toHaveURL(/\/settings\/cameras\/camera-1\/privacy$/)
    await expect(page.getByText('Caméra non tournée, enregistrement désactivé')).toBeVisible()
    // The page's own loading state is a status too: read the one that explains the miss.
    const why = page.getByRole('status').filter({ hasText: 'ne s’est pas tournée' })
    await expect(why).toContainText('ne s’est pas tournée vers sa position Parking')
    await expect(why).toContainText('ONVIF Ptz: no answer')
  })
})
