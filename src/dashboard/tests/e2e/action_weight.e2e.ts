import { test, expect, type Locator } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeChannel,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

// The token values these read: `--alert-high`, `--ink-strong` and `--brand-moss` of `src/index.css`.
const DESTRUCTIVE = 'rgb(176, 76, 48)'
const INK = 'rgb(24, 32, 29)'
const MOSS = 'rgb(47, 107, 89)'
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

async function heightOf(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.height ?? 0
}

/** Whether a finger landing 22 px above or below the control's middle still reaches it. */
async function reachesAFinger(control: Locator): Promise<boolean> {
  return control.evaluate((target) => {
    const box = target.getBoundingClientRect()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    return [y - 21.5, y + 21.5].every((at) => target.contains(document.elementFromPoint(x, at)))
  })
}

function channelState() {
  return createFakeBackendState({ notificationChannels: { telegram: makeFakeChannel('telegram') } })
}

test.describe('Action weight', () => {
  test('DeleteChannel_ShouldCloseThePageQuietly_WhenTheChannelIsConfigured', async ({ page }) => {
    await installFakeBackend(page, channelState())
    await page.goto('/settings/notifications/telegram')

    const remove = page.getByRole('button', { name: 'Supprimer le canal' })
    await expect(remove).toHaveCSS('color', DESTRUCTIVE)
    await expect(remove).toHaveCSS('border-top-width', '1px')
    await expect(remove).not.toHaveCSS('background-color', TRANSPARENT)

    const removeTop = (await remove.boundingBox())?.y ?? 0
    const advancedTop = (await page.locator('summary', { hasText: 'Avancé' }).boundingBox())?.y ?? 0
    const testTop =
      (await page.getByRole('button', { name: 'Envoyer un message de test' }).boundingBox())?.y ?? 0
    expect(removeTop).toBeGreaterThan(advancedTop)
    expect(removeTop).toBeGreaterThan(testTop)

    await remove.click()
    await expect(
      page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }),
    ).toHaveCSS('background-color', DESTRUCTIVE)
  })

  test('SecondaryAction_ShouldCarryItsIconOnTheNeutralTint_WhenItSitsOnACardOrThePage', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [makeFakeCamera()],
        notificationChannels: { telegram: makeFakeChannel('telegram') },
      }),
    )

    await page.goto('/settings/notifications/telegram')
    const onCard = page.getByRole('button', { name: 'Envoyer un message de test' })
    await expect(onCard).toHaveCSS('color', INK)
    await expect(onCard).not.toHaveCSS('background-color', TRANSPARENT)
    await expect(onCard.locator('svg')).toBeVisible()

    await page.goto('/')
    const onPage = page.getByRole('button', { name: 'Tout couper' })
    await expect(onPage).toHaveCSS('color', INK)
    await expect(onPage).not.toHaveCSS('background-color', TRANSPARENT)
    await expect(onPage.locator('svg')).toBeVisible()
  })

  test('SettingsPage_ShouldShowOneGreenButtonAtMost_WhenItOffersSeveralActions', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
    await expect(page.getByRole('button', { name: 'Vérifier' })).toBeVisible()

    const green = await page
      .locator('main button, main a[data-slot="button"]')
      .evaluateAll(
        (controls, moss) =>
          controls.filter((control) => getComputedStyle(control).backgroundColor === moss).length,
        MOSS,
      )

    expect(green).toBeLessThanOrEqual(1)
  })

  test('FoldAndSecondaryAction_ShouldShareTheNeutralTint_WhenTheySitOnOneCard', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')

    const tint = await page
      .getByRole('button', { name: 'Vérifier' })
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    await expect(page.locator('details', { hasText: 'Options' }).first()).toHaveCSS(
      'background-color',
      tint,
    )
    await expect(page.getByRole('link', { name: 'Connexion' })).toHaveCSS('background-color', tint)
  })

  test('Button_ShouldShareTheNavigationPill_WhenItSitsInTheHeader', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [makeFakeCamera()], pendingChanges: true }),
    )
    await page.goto('/')

    const apply = page.getByRole('button', { name: 'Appliquer les changements' })
    const home = page.getByRole('link', { name: 'Accueil' })
    expect(await heightOf(apply)).toBe(await heightOf(home))
    await expect(apply).toHaveCSS('border-top-left-radius', /e\+|\d{3,}px/)
  })

  test('DetectionHistory_ShouldOfferItsRowActionAsAGhostButton_WhenADetectionCanBeIdentified', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ detectionHistory: [makeFakeDetectionEvent({ eventId: 'e1' })] }),
    )
    await page.goto('/history')

    const identify = page.getByRole('button', { name: 'Identifier' })
    await expect(identify).toHaveCSS('border-top-width', '0px')
    await expect(identify).toHaveCSS('color', INK)
  })

  test('DurationSetting_ShouldReadItsUnitInsideAFieldSizedToItsValue_WhenItRenders', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/conservation')

    const field = page.getByRole('spinbutton').first()
    const unit = page.locator('[data-setting-control]').first().getByText('jours', { exact: true })
    const fieldBox = await field.boundingBox()
    const unitBox = await unit.boundingBox()

    expect(fieldBox?.width).toBeLessThanOrEqual(160)
    expect(unitBox!.x).toBeGreaterThan(fieldBox!.x)
    expect(unitBox!.x + unitBox!.width).toBeLessThan(fieldBox!.x + fieldBox!.width)
  })

  test('MultiChoiceOption_ShouldTakeTheClickableRadius_WhenTheListOpens', async ({ page }) => {
    await installFakeBackend(page, channelState())
    await page.goto('/settings/notifications/telegram')
    await page.getByRole('combobox', { name: 'Ce qui déclenche une notification' }).click()

    await expect(
      page
        .getByRole('group', { name: 'Ce qui déclenche une notification' })
        .locator('label')
        .first(),
    ).toHaveCSS('border-top-left-radius', '12px')
  })
})

test.describe('Touch size', () => {
  test('Controls_ShouldReachAFinger_WhenTheScreenIsAPhone', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [makeFakeCamera()],
        notificationChannels: { telegram: makeFakeChannel('telegram') },
        profiles: [
          {
            id: 'profile-1',
            name: 'Camille',
            category: 'family',
            alertMode: 'never',
            lastSeenAt: null,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )

    await page.goto('/settings/notifications/telegram')
    const sendTest = page.getByRole('button', { name: 'Envoyer un message de test' })
    expect(await heightOf(sendTest)).toBe(40)
    expect(await reachesAFinger(sendTest)).toBe(true)
    expect(
      await reachesAFinger(page.getByRole('button', { name: /À quoi sert « Token du bot »/ })),
    ).toBe(true)
    expect(await reachesAFinger(page.getByRole('button', { name: 'Afficher' }))).toBe(true)
    expect(
      await heightOf(page.getByRole('textbox', { name: 'Identifiant de conversation' })),
    ).toBeGreaterThanOrEqual(44)
    expect(
      await heightOf(page.getByRole('combobox', { name: 'Ce qui déclenche une notification' })),
    ).toBeGreaterThanOrEqual(44)

    await page.goto('/settings/detection/personnes/profile-1/identite')
    expect(
      await heightOf(page.getByRole('combobox', { name: 'Lien avec vous' })),
    ).toBeGreaterThanOrEqual(44)

    await page.goto('/')
    const pause = page.getByRole('button', { name: 'Pause' })
    expect(await heightOf(pause)).toBe(32)
    expect(await reachesAFinger(pause)).toBe(true)

    await page.goto('/settings/cameras')
    expect(
      await heightOf(page.getByRole('link', { name: /Porte d’entrée/ }).first()),
    ).toBeGreaterThanOrEqual(44)
  })

  test('Controls_ShouldKeepTheirSize_WhenTheScreenIsWide', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await installFakeBackend(page, channelState())
    await page.goto('/settings/notifications/telegram')

    expect(await heightOf(page.getByRole('button', { name: 'Envoyer un message de test' }))).toBe(
      40,
    )
    expect(await heightOf(page.getByRole('textbox', { name: 'Identifiant de conversation' }))).toBe(
      40,
    )
  })
})
