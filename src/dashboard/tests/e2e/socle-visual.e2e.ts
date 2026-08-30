import { test, expect, type Locator } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * The WCAG contrast ratio between an element and the background it covers - the only
 * way to hold "it reads", which visibility in the layout sense does not say.
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

    // The pill background is semi-transparent: what counts is what the eye sees,
    // hence the result composed over the surface carrying it.
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
 * The Tailwind preflight neutralises the default styles of elements. What `index.css`
 * then puts back - the title font, the control font, the radius of surfaces - would be
 * lost silently: nothing breaks, everything just starts looking like a bare page. This
 * test holds it.
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

    // Surfaces keep their large radii: that is what tells their scale apart from the
    // tighter one of clickable elements.
    const cardRadius = await page
      .locator('.rounded-card')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
    expect(cardRadius).toBe('24px')

    await page.screenshot({ path: 'test-results/socle-hub.png', fullPage: true })

    // A status pill has to read. The old ones painted their text light for a dark
    // panel: laid on a light surface, they became invisible - and `toBeVisible()`
    // said nothing about it.
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
