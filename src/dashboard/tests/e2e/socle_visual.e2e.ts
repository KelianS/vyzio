import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'
import { fullPageScreenshot } from './fixtures/full_page_screenshot'

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
    await expect(page.getByRole('button', { name: 'Couper les caméras' })).toBeVisible()

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

    // A camera's state reads from its mark, the same one on every screen (UI-31).
    await page.goto('/settings/cameras')
    await expect(page.getByRole('img', { name: 'En marche' })).toBeVisible()

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
    await expect(page.getByRole('button', { name: 'Couper les caméras' })).toBeVisible()

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

// The token values these read: `--line`, `--surface` and `--action` of `src/index.css`.
const LINE_SOFT = 'rgb(44, 51, 47)'
const ELEVATED = 'rgb(27, 32, 29)'
const MOSS = 'rgb(127, 209, 168)'

test.describe('Style foundations', () => {
  test('Border_ShouldTakeTheLineColour_WhenItNamesNoBorderColour', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Couper les caméras' })).toBeVisible()

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

    const cutAll = page.getByRole('button', { name: 'Couper les caméras' })
    await expect(cutAll).toHaveCSS('font-size', '15px')
    await expect(cutAll).toHaveCSS('font-weight', '600')
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

    const cutAll = page.getByRole('button', { name: 'Couper les caméras' })
    const resting = await cutAll.evaluate((el) => getComputedStyle(el).backgroundColor)
    await cutAll.hover()

    await expect(cutAll).not.toHaveCSS('background-color', resting)
  })

  test('ConfirmDialog_ShouldBeDrawnAsAPanel_WhenItOpens', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/access')
    await page.getByRole('button', { name: 'Déconnecter tous les appareils' }).click()

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
