import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Le socle Tailwind introduit un preflight qui neutralise les styles par defaut
 * des elements. Les ecrans non encore repris comptent dessus (ADR-42) : ce test
 * verifie qu'ils traversent l'operation intacts.
 *
 * Le theme sombre n'est pas teste ici et c'est delibere : il n'est branche qu'a
 * partir de la coquille de navigation (voir `src/common/theme.ts`), parce que
 * l'activer sur les ecrans non repris introduirait des defauts de contraste au
 * lieu d'en reveler.
 */
test.describe('Socle — non-regression du preflight', () => {
  test('socle_When Tailwind preflight is active_Should leave existing screens intact', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))

    await page.goto('/')
    await expect(
      page.locator('.hub-status-bar, .hub-setup-hero, .hub-degraded-panel'),
    ).toBeVisible()

    // Tant que la coquille n'est pas livree, aucun theme sombre n'est applique.
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // Le preflight ecrase en premier la police des titres et celle des controles.
    // Les deux sont rattrapes dans index.css ; sans ce test la perte serait
    // silencieuse et ne se verrait qu'a l'oeil, longtemps apres.
    const headingFont = await page
      .locator('h2')
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)
    expect(headingFont).toContain('Iowan Old Style')

    const controlFont = await page
      .locator('button')
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)
    expect(controlFont).toContain('Aptos')

    // Les surfaces gardent leurs grands rayons : c'est ce qui distingue
    // l'echelle des surfaces de celle, plus serree, des elements cliquables.
    const panelRadius = await page
      .locator('.panel')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
    expect(panelRadius).toBe('24px')

    await page.screenshot({ path: 'test-results/socle-hub.png', fullPage: true })

    await page.goto('/cameras')
    await expect(page.getByRole('heading', { name: 'Decouverte guidee' })).toBeVisible()
    await page.screenshot({ path: 'test-results/socle-parametres.png', fullPage: true })
  })
})
