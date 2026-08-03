import { test, expect, type Locator } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Rapport de contraste WCAG entre un element et le fond qu'il recouvre — la
 * seule facon de tenir « ca se lit », que la visibilite au sens de la mise en
 * page ne dit pas.
 */
async function contrastOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number)
    const luminance = ([r, g, b]: number[]) => {
      const channel = (c: number) => {
        const v = c / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }

    // Le fond de la pastille est semi-transparent : ce qui compte est ce que
    // l'oeil voit, donc le resultat compose sur la surface qui la porte.
    const over = (front: number[], back: number[]) => {
      const alpha = front[3] ?? 1
      return [0, 1, 2].map((i) => front[i] * alpha + back[i] * (1 - alpha))
    }

    let node: HTMLElement | null = el as HTMLElement
    let backdrop = [255, 255, 255]
    while (node) {
      const layer = parse(getComputedStyle(node).backgroundColor)
      if (layer.length && (layer[3] ?? 1) > 0) {
        backdrop =
          layer[3] === 1 || layer[3] === undefined ? layer.slice(0, 3) : over(layer, backdrop)
        if ((layer[3] ?? 1) === 1) break
      }
      node = node.parentElement
    }

    const text = over(parse(getComputedStyle(el).color), backdrop)
    const [bright, dark] = [luminance(text), luminance(backdrop)].sort((a, b) => b - a)
    return (bright + 0.05) / (dark + 0.05)
  })
}

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

    // Une pastille d'etat doit se lire. Les anciennes peignaient leur texte en
    // clair pour un panneau sombre : posees sur une surface claire, elles
    // devenaient invisibles — et `toBeVisible()` n'en disait rien.
    await page.goto('/settings/cameras')
    const badge = page.getByText('Connectee')
    await expect(badge).toBeVisible()
    expect(await contrastOf(badge)).toBeGreaterThan(3)

    // The iframe shell, last screen brought onto the socle.
    await page.goto('/settings/systeme/avance')
    await expect(
      page
        .getByRole('status', { name: 'Chargement de Frigate…' })
        .or(page.getByTitle('Frigate NVR'))
        .or(page.getByRole('heading', { name: 'Frigate inaccessible' }))
        .first(),
    ).toBeVisible()
    await page.screenshot({ path: 'test-results/socle-parametres.png', fullPage: true })
  })
})
