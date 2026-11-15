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

    const headingFont = await page
      .locator('h1')
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)
    expect(headingFont).toContain('Inter')

    const controlFont = await page
      .locator('button')
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)
    expect(controlFont).toContain('Inter')

    // Surfaces keep their large radii: that is what tells their scale apart from the
    // tighter one of clickable elements.
    const cardRadius = await page
      .locator('.rounded-card')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
    expect(cardRadius).toBe('20px')

    await fullPageScreenshot(page, { path: 'test-results/socle-hub.png' })

    // A status pill has to read. The old ones painted their text light for a dark
    // panel: laid on a light surface, they became invisible - and `toBeVisible()`
    // said nothing about it.
    await page.goto('/settings/cameras')
    const badge = page.getByText('Connectée')
    await expect(badge).toBeVisible()
    expect(await contrastOf(badge)).toBeGreaterThan(3)

    // The iframe shell, last screen brought onto the socle.
    await page.goto('/settings/hardware/advanced')
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

// The token values these read: `--line`, `--raised`, `--surface` and `--action` of `src/index.css`.
const LINE_SOFT = 'rgb(44, 51, 47)'
const SUNKEN = 'rgb(36, 42, 38)'
const ELEVATED = 'rgb(27, 32, 29)'
const MOSS = 'rgb(127, 209, 168)'

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
    await expect(pause).toHaveCSS('font-size', '15px')
    await expect(pause).toHaveCSS('font-weight', '600')
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

  test('WelcomeStep_ShouldShowItsNumberBesideItsTitle_WhenTheHubHasNoCamera', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/')

    const step = page.getByRole('listitem').first()
    const number = (await step.getByText('1', { exact: true }).boundingBox())!
    const title = (await step.getByText('Ajouter une caméra').boundingBox())!

    expect(number.x + number.width).toBeLessThanOrEqual(title.x)
    expect(number.y).toBeLessThanOrEqual(title.y + title.height)
    expect(number.y + number.height).toBeGreaterThanOrEqual(title.y)
  })

  test('PhotoAdvice_ShouldReadNoLargerThanTheStateAboveTheButton_WhenThePersonHasNoPhoto', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        profiles: [
          {
            id: 'profile-1',
            name: 'Alice',
            category: 'family',
            alertMode: 'always',
            lastSeenAt: null,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
    await page.goto('/settings/detection/people/profile-1/photos')

    const state = page.getByText(/^Aucune photo/)
    const advice = page.getByText(/^Des photos nettes/)
    await expect(state).toHaveCSS('font-size', '15px')
    await expect(advice).toHaveCSS('font-size', '15px')
    const adviceBox = (await advice.boundingBox())!
    const addBox = (await page.getByRole('button', { name: 'Ajouter une photo' }).boundingBox())!
    expect(adviceBox.y).toBeLessThan(addBox.y)
  })

  test('SecondaryAction_ShouldDarken_WhenHovered', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')

    const cutAll = page.getByRole('button', { name: 'Tout couper' })
    const resting = await cutAll.evaluate((el) => getComputedStyle(el).backgroundColor)
    await cutAll.hover()

    await expect(cutAll).not.toHaveCSS('background-color', resting)
  })

  test('ConfirmDialog_ShouldBeDrawnAsAPanel_WhenItOpens', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Pause' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toHaveCSS('border-top-left-radius', '28px')
    await expect(dialog).toHaveCSS('border-top-width', '0px')
    await expect(dialog).toHaveCSS('background-color', ELEVATED)
    // A surface carries no shadow, a dialog included.
    await expect(dialog).not.toHaveCSS('box-shadow', /px/)
  })

  test('ConfirmDialog_ShouldConfirmWithTheFilledButton_WhenItAsksPlainly', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/access')
    await page.getByRole('button', { name: 'Déconnecter tous les appareils' }).click()

    await expect(
      page.getByRole('alertdialog').getByRole('button', { name: 'Déconnecter' }),
    ).toHaveCSS('background-color', MOSS)
  })

  test('ClosedFold_ShouldTakeTheClickableRadius_WhenItSitsInACard', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connection')

    await expect(page.locator('summary', { hasText: 'Options' }).first()).toHaveCSS(
      'border-top-left-radius',
      '16px',
    )
  })
})
