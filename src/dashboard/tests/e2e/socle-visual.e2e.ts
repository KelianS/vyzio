import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Le preflight Tailwind neutralise les styles par defaut des elements. Ce que
 * `index.css` rattrape ensuite — la police des titres, celle des controles, le
 * rayon des surfaces — se perdrait en silence : rien ne casse, tout se met a
 * ressembler a une page nue. Ce test le tient.
 */
test.describe('Socle — typographie et surfaces', () => {
  test('socle_When Tailwind preflight is active_Should keep headings, controls and surfaces', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))

    await page.goto('/')
    await expect(page.getByRole('heading', { name: /sous surveillance|Bienvenue/ })).toBeVisible()

    await expect(page.locator('html')).not.toHaveClass(/dark/)

    const headingFont = await page
      .locator('h1')
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)
    expect(headingFont).toContain('Iowan Old Style')

    const controlFont = await page
      .locator('button')
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)
    expect(controlFont).toContain('Aptos')

    // Les surfaces gardent leurs grands rayons : c'est ce qui distingue leur
    // echelle de celle, plus serree, des elements cliquables.
    const cardRadius = await page
      .locator('.rounded-card')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
    expect(cardRadius).toBe('24px')

    await page.screenshot({ path: 'test-results/socle-hub.png', fullPage: true })

    // Le dernier ecran encore hors socle, tel que le preflight le laisse.
    await page.goto('/settings/systeme/avance')
    await expect(page.locator('.expert-shell, .expert-error-panel')).toBeVisible()
    await page.screenshot({ path: 'test-results/socle-parametres.png', fullPage: true })
  })
})
