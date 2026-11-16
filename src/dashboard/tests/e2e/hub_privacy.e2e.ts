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
    // The page's own loading state is a status too: read the one that explains the miss.
    const why = page.getByRole('status').filter({ hasText: 'ne s’est pas tournée' })
    await expect(why.getByText('La caméra ne s’est pas tournée', { exact: true })).toBeVisible()
    await expect(why.getByRole('button', { name: 'Réessayer' })).toBeVisible()
    await expect(why.getByText('Enregistrement désactivé')).toBeVisible()
    await why.getByText('Détails techniques').click()
    await expect(why.getByText(/ne s’est pas tournée vers sa position Parking/)).toBeVisible()
    await expect(why.getByText(/ONVIF Ptz: no answer/)).toBeVisible()
  })

  test('CameraPrivacyView_ShouldClearTheMiss_WhenTheUserRetriesAndTheCameraFollows', async ({
    page,
  }) => {
    const interrupted = makeFakeCamera({
      id: 'camera-1',
      displayName: 'Salon',
      privacyStrategy: 'ptz_parking',
      ptzSupported: true,
      privacyMiss: 'unconfirmed',
      privacyMissDetail: 'privacy off, ptz_parking: interrupted before the camera answered',
    })
    await installFakeBackend(page, createFakeBackendState({ cameras: [interrupted] }))

    await page.goto('/settings/cameras/camera-1/privacy')
    await expect(page.getByText('La caméra n’a peut-être pas repris sa position')).toBeVisible()
    await page.getByRole('button', { name: 'Réessayer' }).click()

    await expect(page.getByText('La caméra a suivi.')).toBeVisible()
    await expect(page.getByText('La caméra n’a peut-être pas repris sa position')).toHaveCount(0)
  })
})
