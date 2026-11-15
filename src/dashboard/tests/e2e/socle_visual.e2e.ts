import { test, expect, type Locator } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'
import { fullPageScreenshot } from './fixtures/full_page_screenshot'

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
test.describe('Base styles', () => {
  test('BaseStyles_ShouldKeepHeadingsControlsAndSurfaces_WhenTailwindPreflightIsActive', async ({
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

    await fullPageScreenshot(page, { path: 'test-results/socle-hub.png' })

    // A status pill has to read. The old ones painted their text light for a dark
    // panel: laid on a light surface, they became invisible - and `toBeVisible()`
    // said nothing about it.
    await page.goto('/settings/cameras')
    const badge = page.getByText('Connectée')
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
    await fullPageScreenshot(page, { path: 'test-results/socle-parametres.png' })
  })

  test('BaseStyles_ShouldKeepTheFieldSelectableAndItsNameNot_WhenAFieldSitsInsideItsLabel', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /sous surveillance|Bienvenue/ })).toBeVisible()

    // A field wrapped in its label, as the camera forms write it.
    const [name, field] = await page.evaluate(() => {
      const label = document.createElement('label')
      const span = document.createElement('span')
      span.textContent = 'Identifiant'
      const input = document.createElement('input')
      label.append(span, input)
      document.body.append(label)
      return [getComputedStyle(span).userSelect, getComputedStyle(input).userSelect]
    })

    expect(name).toBe('none')
    expect(field).toBe('text')
  })
})

// The token values these read: `--line-soft`, `--bg-sunken`, `--bg-elevated`, `--brand-moss` and `--shadow-soft` of `src/index.css`.
const LINE_SOFT = 'rgb(216, 207, 191)'
const SUNKEN = 'rgb(242, 235, 223)'
const ELEVATED = 'rgb(255, 250, 242)'
const MOSS = 'rgb(47, 107, 89)'
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

test.describe('Style foundations', () => {
  test('Border_ShouldTakeTheLineColour_WhenItNamesNoBorderColour', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /sous surveillance/ })).toBeVisible()

    // A bare `border`, as a framed tile writes it.
    const colour = await page.evaluate(() => {
      const tile = document.createElement('div')
      tile.className = 'border'
      document.body.append(tile)
      return getComputedStyle(tile).borderTopColor
    })

    expect(colour).toBe(LINE_SOFT)
  })

  test('Button_ShouldTakeItsOwnTextSizeAndWeight_WhenItIsAButtonElement', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')

    const pause = page.getByRole('button', { name: 'Pause' })
    await expect(pause).toHaveCSS('font-size', '14px')
    await expect(pause).toHaveCSS('font-weight', '500')
  })

  test('WelcomeStepNumber_ShouldSitOnAnOpaqueSunkenSurface_WhenTheHubHasNoCamera', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/')

    await expect(page.getByRole('listitem').first().getByText('1', { exact: true })).toHaveCSS(
      'background-color',
      SUNKEN,
    )
  })

  test('OutlineButton_ShouldTintWithTheProductColour_WhenHovered', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')

    const cutAll = page.getByRole('button', { name: 'Tout couper' })
    await expect(cutAll).toHaveCSS('background-color', TRANSPARENT)
    await cutAll.hover()

    await expect(cutAll).not.toHaveCSS('background-color', TRANSPARENT)
  })

  test('ConfirmDialog_ShouldBeDrawnAsAPanel_WhenItOpens', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Pause' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toHaveCSS('border-top-left-radius', '28px')
    await expect(dialog).toHaveCSS('border-top-width', '0px')
    await expect(dialog).toHaveCSS('background-color', ELEVATED)
    // Tailwind composes its empty ring layers before the shadow token: the token is the last layer.
    await expect(dialog).toHaveCSS('box-shadow', /, rgba\(24, 32, 29, 0\.08\) 0px 18px 50px 0px$/)
  })

  test('ConfirmDialog_ShouldDrawItsPlainActionAsATonalButton_WhenItAsksPlainly', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/acces')
    await page.getByRole('button', { name: 'Déconnecter tous les appareils' }).click()

    const disconnect = page.getByRole('alertdialog').getByRole('button', { name: 'Déconnecter' })
    await expect(disconnect).toHaveCSS('color', MOSS)
    await expect(disconnect).not.toHaveCSS('background-color', ELEVATED)
    await expect(disconnect).not.toHaveCSS('background-color', TRANSPARENT)
  })

  test('ClosedFold_ShouldTakeTheClickableRadius_WhenItSitsInACard', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')

    await expect(page.locator('summary', { hasText: 'Options' }).first()).toHaveCSS(
      'border-top-left-radius',
      '12px',
    )
  })
})
