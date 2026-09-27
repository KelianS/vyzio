import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

test.describe('HubView technical details', () => {
  test('SurveillanceCard_ShouldShowTheFiguresUnderTheCameraNames_WhenTheUserOpensTheDetails', async ({
    page,
  }) => {
    const salon = makeFakeCamera({ id: 'camera-1', slug: 'salon', displayName: 'Salon' })
    const jardin = makeFakeCamera({ id: 'camera-2', slug: 'jardin', displayName: 'Jardin' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon, jardin] }))

    await page.goto('/')
    const card = page.getByRole('region', { name: 'Surveillance' })

    // The card says one state and one gauge; the figures for support wait behind the fold.
    await expect(card.getByText('En marche')).toBeVisible()
    await expect(card.getByText('380 Go libres sur 500 Go')).toBeVisible()
    await expect(card.getByText('Images reçues par seconde')).toBeHidden()

    await card.getByText('Détails techniques').click()

    await expect(card.getByText('Processeur · 5 images par seconde')).toBeVisible()
    await expect(card.getByText('Salon')).toBeVisible()
    await expect(card.getByText('Jardin')).toBeVisible()
    await expect(card.getByText('salon', { exact: true })).toHaveCount(0)
  })

  test('SurveillanceCard_ShouldStayFoldedAndQuiet_WhenAWatchedCameraIsOffline', async ({
    page,
  }) => {
    const salon = makeFakeCamera({ id: 'camera-1', slug: 'salon', displayName: 'Salon' })
    const jardin = makeFakeCamera({
      id: 'camera-2',
      slug: 'jardin',
      displayName: 'Jardin',
      status: 'offline',
    })
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon, jardin] }))

    await page.goto('/')
    const card = page.getByRole('region', { name: 'Surveillance' })

    // The camera's own status already says it is offline: the card adds nothing.
    await expect(card.getByText('380 Go libres sur 500 Go')).toBeVisible()
    await expect(card.getByText('Images reçues par seconde')).toBeHidden()
    await expect(card.getByText(/Trop peu d’images/)).toHaveCount(0)
  })

  test('SurveillanceCard_ShouldLinkTheLaggingCameraOnOneLine_WhenAnOnlineCameraLags', async ({
    page,
  }) => {
    const salon = makeFakeCamera({ id: 'camera-1', slug: 'salon', displayName: 'Salon' })
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [salon], receivedFps: { 'camera-1': 0.4 } }),
    )

    await page.goto('/')
    const card = page.getByRole('region', { name: 'Surveillance' })

    await expect(card.getByText(/Trop peu d’images reçues de/)).toBeVisible()
    await expect(card.getByText('Images reçues par seconde')).toBeHidden()

    await card.getByRole('link', { name: 'Salon' }).click()

    await expect(page).toHaveURL(/\/settings\/cameras\/camera-1\/connexion$/)
  })
})
