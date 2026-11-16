import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  fakeHouseMomentIn,
  makeFakeCamera,
} from './fixtures/fake_backend'

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

  test('CutCameras_ShouldCutEveryCameraThenOfferToResumeThem_WhenTheUserPicksUntilReactivation', async ({
    page,
  }) => {
    const salon = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    const jardin = makeFakeCamera({ id: 'camera-2', slug: 'jardin', displayName: 'Jardin' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon, jardin] }))

    await page.goto('/')
    await page.getByRole('button', { name: 'Couper les caméras' }).click()
    // The sheet is the confirmation: one tap cuts and closes it (PRIV-22).
    const sheet = page.getByRole('dialog', { name: 'Couper les caméras' })
    await sheet.getByRole('button', { name: 'Jusqu’à réactivation' }).click()

    await expect(sheet).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Réactiver les caméras' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Coupée' })).toHaveCount(2)
  })

  test('CutCameras_ShouldSayUntilWhenThenResumeThemAllOnATap_WhenADurationIsPicked', async ({
    page,
  }) => {
    const salon = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    const jardin = makeFakeCamera({ id: 'camera-2', slug: 'jardin', displayName: 'Jardin' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon, jardin] }))

    await page.goto('/')
    await page.getByRole('button', { name: 'Couper les caméras' }).click()
    await page
      .getByRole('dialog', { name: 'Couper les caméras' })
      .getByRole('button', { name: '2 heures' })
      .click()

    // The pill and every card say until when (PRIV-20, PRIV-22).
    const pill = page.getByRole('button', { name: /^Caméras coupées jusqu’à \d+ h/ })
    await expect(pill).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/^Coupée jusqu’à \d+ h/)).toHaveCount(2)

    await pill.click()
    await expect(page.getByRole('img', { name: 'En marche' })).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Couper les caméras' })).toBeVisible()
  })

  test('CutCameras_ShouldOfferTheScheduleNextChange_WhenAPrivacyRangeExists', async ({ page }) => {
    const nextChange = fakeHouseMomentIn(90)
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })],
      camerasCutNextChange: nextChange,
    })
    await installFakeBackend(page, state)

    await page.goto('/')
    await page.getByRole('button', { name: 'Couper les caméras' }).click()
    const options = page.getByRole('dialog', { name: 'Couper les caméras' }).getByRole('button')
    await expect(options.nth(1)).toContainText('Ensuite, la planification reprend')
    await options.nth(1).click()

    await expect(page.getByRole('button', { name: /^Caméras coupées jusqu’à/ })).toBeVisible()
    expect(state.cameras[0].privacyCutUntil).toEqual(nextChange)
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

  test('CameraEye_ShouldSayInAToastThatTheCameraDidNotTurnAndOfferARetry_WhenItDidNotFollow', async ({
    page,
  }) => {
    const salon = makeFakeCamera({
      id: 'camera-1',
      displayName: 'Salon',
      privacyStrategy: 'ptz_parking',
      ptzSupported: true,
    })
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [salon],
        privacyMissOnToggle: {
          miss: 'camera_failed',
          detail: 'privacy on, ptz_parking: ONVIF Ptz: no answer',
        },
      }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: 'Couper Salon' }).click()

    // The answer to the user's own act is a toast, never a line on the card nor a bar alert.
    const toasts = page.getByRole('region', { name: 'Notifications' })
    await expect(toasts.getByText('Salon : la caméra ne s’est pas tournée.')).toBeVisible()
    await expect(toasts.getByText('privacy on, ptz_parking: ONVIF Ptz: no answer')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Alertes' })).toHaveCount(0)
    await expect(page.getByRole('article').getByText(/ne s’est pas tournée/)).toHaveCount(0)

    await toasts.getByRole('button', { name: 'Réessayer' }).click()
    await expect(toasts.getByText('Salon : la caméra a suivi.')).toBeVisible()
  })

  test('TopBar_ShouldSayWhichCameraDidNotTurnAndLeadToIt_WhenARangeCutIt', async ({ page }) => {
    const parked = makeFakeCamera({
      id: 'camera-1',
      displayName: 'Salon',
      privacyModeActive: true,
      privacyModeSource: 'schedule',
      privacyStrategy: 'ptz_parking',
      ptzSupported: true,
      privacyMiss: 'camera_failed',
      privacyMissDetail: 'privacy on, ptz_parking: ONVIF Ptz: no answer',
    })
    await installFakeBackend(page, createFakeBackendState({ cameras: [parked] }))

    await page.goto('/settings/cameras/camera-1/privacy')

    // A state no act caused lasts in the bar; the page itself carries no warning row.
    const alerts = page.getByRole('list', { name: 'Alertes' })
    await expect(alerts.getByText('Salon : la caméra ne s’est pas tournée')).toBeVisible()
    await expect(page.getByText(/ne s’est pas tournée/)).toHaveCount(1)
    await alerts.getByRole('link', { name: /Salon : la caméra ne s’est pas tournée/ }).click()
    await expect(page).toHaveURL(/\/cameras\/camera-1$/)
  })
})
