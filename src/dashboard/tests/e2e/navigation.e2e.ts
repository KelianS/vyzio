import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

test.describe('Navigation', () => {
  test('AppShell_ShouldReachEveryScreenWithoutErrors_WhenTheUserFollowsTheMenus', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`${msg.text()} @ ${msg.location().url}`)
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))

    const bar = page.getByRole('banner')
    const rubrics = page.getByRole('navigation', { name: 'Rubriques de réglages' })

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Couper les caméras' })).toBeVisible()

    // No navigation bar: the home leads to the detections, the bar's gear to the settings.
    await page.getByRole('link', { name: 'Détections' }).click()
    await expect(bar.getByRole('heading', { name: 'Détections' })).toBeVisible()
    await bar.getByRole('button', { name: 'Retour' }).click()
    await expect(page).toHaveURL('/')

    // Every settings section is reachable from the first level.
    await bar.getByRole('link', { name: 'Réglages' }).click()

    await rubrics.getByRole('link', { name: /Caméras/ }).click()
    // The section opens on the **list**; adding a camera is a distinct task,
    // with a page of its own.
    await expect(page.getByRole('heading', { name: 'Caméras' })).toBeVisible()

    await rubrics.getByRole('link', { name: /Personnes/ }).click()
    await expect(page.getByRole('heading', { name: 'Personnes' })).toBeVisible()

    await rubrics.getByRole('link', { name: /Conservation/ }).click()
    await expect(page.getByRole('heading', { name: 'Conservation' })).toBeVisible()

    await rubrics.getByRole('link', { name: /Notifications/ }).click()
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()

    await rubrics.getByRole('link', { name: /Matériel/ }).click()
    await expect(page.getByRole('heading', { name: 'Matériel' })).toBeVisible()

    // The niche one is folded, not hidden: the technical interface opens in place in Avancé.
    await page.locator('summary', { hasText: /^Avancé/ }).click()
    await expect(page).toHaveURL('/settings/hardware')
    await expect(
      page
        .getByRole('status', { name: 'Chargement de Frigate…' })
        .or(page.getByTitle('Frigate NVR'))
        .or(page.getByRole('heading', { name: 'Frigate inaccessible' }))
        .first(),
    ).toBeVisible()

    await page.goto('/settings')
    await bar.getByRole('button', { name: 'Retour' }).click()
    await expect(page).toHaveURL('/')

    expect(consoleErrors, `Console errors while navigating:\n${consoleErrors.join('\n')}`).toEqual(
      [],
    )
  })

  test('BackButton_ShouldReachHomeInThreeTaps_WhenAProtocolCardIsOpen', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    const bar = page.getByRole('banner')
    const back = bar.getByRole('button', { name: 'Retour' })
    await page.goto('/')
    await bar.getByRole('link', { name: 'Réglages' }).click()
    await page.getByRole('link', { name: /Caméras/ }).click()
    await page.getByRole('link', { name: /Porte d’entrée/ }).click()
    await page.locator('summary', { hasText: /^Avancé/ }).click()
    await page
      .getByRole('region', { name: 'Protocoles' })
      .getByRole('heading', { name: 'RTSP' })
      .click()

    await back.click()
    await expect(page).toHaveURL('/settings/cameras')
    await back.click()
    await expect(page).toHaveURL('/settings')
    await back.click()
    await expect(page).toHaveURL('/')
  })

  test('CamerasView_ShouldOpenOnConnexionWithTabsInSetupOrder_WhenACameraIsPickedFromTheList', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras')

    await page.getByRole('link', { name: /Porte d’entrée/ }).click()

    await expect(page).toHaveURL('/settings/cameras/camera-1/connection')
    const tabs = page.getByRole('navigation', { name: 'Réglages de la caméra' })
    await expect(tabs.getByRole('link', { name: 'Connexion' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(tabs.getByRole('link')).toHaveText([
      'Connexion',
      'Vie privée',
      'Détection',
      'Image et pilotage',
      'Conservation',
    ])
  })

  test('CamerasView_ShouldFadeTheTabsOut_WhenMoreAreHiddenOnAPhone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [makeFakeCamera({ id: 'camera-1' })] }),
    )

    await page.goto('/settings/cameras/camera-1/detection')

    await expect(page.getByRole('navigation', { name: 'Réglages de la caméra' })).toHaveCSS(
      'mask-image',
      /linear-gradient/,
    )
  })

  test('CamerasView_ShouldBringTheCurrentTabIntoView_WhenOpenedOnAPhone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [makeFakeCamera({ id: 'camera-1' })] }),
    )

    await page.goto('/settings/cameras/camera-1/retention')

    const tabs = page.getByRole('navigation', { name: 'Réglages de la caméra' })
    // One row that scrolls: landing on the last tab must still show it.
    await expect(tabs.getByRole('link')).toHaveCount(5)
    await expect(tabs.getByRole('link', { name: 'Conservation' })).toBeInViewport({ ratio: 0.9 })
    // The name heads the camera's screens; its address lives on Connexion.
    await expect(page.getByText('192.168.1.50:554')).toHaveCount(0)
  })
})
