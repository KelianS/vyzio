import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

const refused = () =>
  createFakeBackendState({
    cameras: [makeFakeCamera({ accountRefusedAt: '2026-09-25T10:00:00Z' })],
  })

// A refused password is its own cause, with where to fix it (SPECS 2.2, ADR-58).
test.describe('Refused camera account', () => {
  test('HubView_ShouldNameTheRefusedPasswordOnTheCamera_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/')

    await expect(page.getByText('Mot de passe refusé')).toBeVisible()
    await expect(page.getByText('Reconnexion…')).toHaveCount(0)

    await page.getByRole('link', { name: 'Corriger le mot de passe' }).click()
    await expect(page).toHaveURL(/\/settings\/cameras\/camera-1\/connexion$/)
  })

  test('CameraConnectionPage_ShouldNotSayReachable_WhenTheCameraStillRefusesItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/settings/cameras/camera-1/connexion')

    await page.getByRole('button', { name: 'Vérifier la connexion' }).click()

    await expect(page.getByText('La caméra ne laisse toujours pas entrer Vyzio.')).toBeVisible()
    await expect(page.getByText('Caméra joignable.')).toHaveCount(0)
  })

  test('CameraConnectionPage_ShouldSayRecordingWaitsForTheRestart_WhenTheCheckLetsTheCameraBackIn', async ({
    page,
  }) => {
    const state = refused()
    state.accountRestored = true
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')

    await page.getByRole('button', { name: 'Vérifier la connexion' }).click()

    await expect(
      page.getByText(
        'La caméra accepte son mot de passe. Elle enregistre de nouveau après « Appliquer les changements ».',
      ),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Appliquer les changements' })).toBeVisible()
  })

  test('CameraConnectionPage_ShouldSayUnreachable_WhenARefusedCameraDoesNotAnswerTheCheck', async ({
    page,
  }) => {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ status: 'offline', accountRefusedAt: '2026-09-25T10:00:00Z' })],
    })
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')

    await page.getByRole('button', { name: 'Vérifier la connexion' }).click()

    await expect(page.getByText('Caméra injoignable — vérifiez ces réglages.')).toBeVisible()
    await expect(page.getByText('La caméra ne laisse toujours pas entrer Vyzio.')).toHaveCount(0)
  })

  test('HubView_ShouldNotOpenTheLiveView_WhenTheCameraCannotBeReached', async ({ page }) => {
    const state = createFakeBackendState({
      cameras: [
        makeFakeCamera({
          id: 'camera-1',
          displayName: 'Salon',
          accountRefusedAt: '2026-09-25T10:00:00Z',
        }),
        makeFakeCamera({ id: 'camera-2', displayName: 'Garage', status: 'offline' }),
      ],
    })
    await installFakeBackend(page, state)
    await page.goto('/')

    await expect(page.getByText('Mot de passe refusé')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salon' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Garage' })).toHaveCount(0)
  })

  test('CameraConnectionPage_ShouldSuspendTheCapabilities_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/settings/cameras/camera-1/connexion')

    await expect(
      page.getByText(
        'Mot de passe refusé : la détection reprendra une fois la connexion vérifiée.',
      ),
    ).toBeVisible()
  })

  test('CameraImagePage_ShouldSuspendPilotage_WhenTheCameraRefusedItsAccount', async ({ page }) => {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ ptzSupported: true, accountRefusedAt: '2026-09-25T10:00:00Z' })],
    })
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/image')

    await expect(
      page.getByText('Pilotage suspendu : la caméra refuse son mot de passe.'),
    ).toBeVisible()
  })

  test('CameraListPage_ShouldNameTheRefusedPassword_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/settings/cameras')

    await expect(page.getByText('Mot de passe refusé')).toBeVisible()
    await expect(page.getByText('Connectee')).toHaveCount(0)
  })

  test('CameraShell_ShouldLeadToWhereThePasswordIsFixed_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/settings/cameras/camera-1/detection')

    await page.getByRole('link', { name: 'Mot de passe refusé' }).click()

    await expect(page).toHaveURL(/\/settings\/cameras\/camera-1\/connexion$/)
    const notice = page.getByRole('status')
    await expect(notice).toContainText('Cette caméra n’enregistre plus')
    await expect(notice).toContainText('RTSP DESCRIBE answered 401/403: account refused')
  })
})
