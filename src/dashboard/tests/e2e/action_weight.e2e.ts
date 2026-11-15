import { test, expect, type Locator } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeChannel,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

// The token values these read: `--alert-high`, `--bg-elevated` and `--brand-moss` of `src/index.css`.
const DESTRUCTIVE = 'rgb(176, 76, 48)'
const ELEVATED = 'rgb(255, 250, 242)'
const MOSS = 'rgb(47, 107, 89)'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

async function heightOf(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.height ?? 0
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
    await expect(remove).toHaveCSS('border-top-color', DESTRUCTIVE)
    await expect(remove).toHaveCSS('background-color', ELEVATED)

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

  test('OutlineButton_ShouldRestOnTheCardFill_WhenItSitsOnACard', async ({ page }) => {
    await installFakeBackend(page, channelState())
    await page.goto('/settings/notifications/telegram')

    await expect(page.getByRole('button', { name: 'Envoyer un message de test' })).toHaveCSS(
      'background-color',
      ELEVATED,
    )
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
    await expect(identify).toHaveCSS('color', MOSS)
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
  test('Controls_ShouldBeAFingerTall_WhenTheScreenIsAPhone', async ({ page }) => {
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
    expect(
      await heightOf(page.getByRole('button', { name: 'Envoyer un message de test' })),
    ).toBeGreaterThanOrEqual(44)
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
    expect(await heightOf(page.getByRole('button', { name: 'Pause' }))).toBeGreaterThanOrEqual(44)

    await page.goto('/settings/cameras')
    expect(
      await heightOf(page.getByRole('link', { name: /Porte d’entrée/ }).first()),
    ).toBeGreaterThanOrEqual(44)
  })

  test('Controls_ShouldKeepTheirCompactHeight_WhenTheScreenIsWide', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await installFakeBackend(page, channelState())
    await page.goto('/settings/notifications/telegram')

    expect(await heightOf(page.getByRole('button', { name: 'Envoyer un message de test' }))).toBe(
      36,
    )
    expect(await heightOf(page.getByRole('textbox', { name: 'Identifiant de conversation' }))).toBe(
      36,
    )
  })
})
