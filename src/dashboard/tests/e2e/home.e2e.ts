import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  fakeHouseMomentIn,
  makeFakeCamera,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

const fiveCameras = ['Porte', 'Jardin', 'Garage', 'Salon', 'Cave'].map((name, index) =>
  makeFakeCamera({ id: `camera-${index + 1}`, slug: name.toLowerCase(), displayName: name }),
)

test.describe('Home', () => {
  test('Silence_ShouldStartFromTheSheetThenEndOnATap_WhenTheUserSilencesTheNotifications', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/')
    await page.getByRole('button', { name: 'Silence', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Silence' })
    await expect(sheet).toContainText('Les caméras continuent de filmer et de détecter.')
    await sheet.getByRole('button', { name: '2 heures' }).click()

    // One tap starts it and closes the sheet; the pill and the tile say until when (NOTIF-34).
    await expect(sheet).toHaveCount(0)
    const pill = page.getByRole('button', { name: /^Silence jusqu’à \d+ h/ })
    await expect(pill).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/^En silence jusqu’à \d+\sh/)).toBeVisible()

    await pill.click()
    await expect(page.getByRole('button', { name: 'Silence', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('Silence_ShouldHoldWithNoHour_WhenTheUserPicksUntilReactivation', async ({ page }) => {
    const state = createFakeBackendState()
    await installFakeBackend(page, state)

    await page.goto('/')
    await page.getByRole('button', { name: 'Silence', exact: true }).click()
    const options = page.getByRole('dialog', { name: 'Silence' }).getByRole('button')
    await expect(options.first()).toHaveText('Jusqu’à réactivation')
    await options.first().click()

    await expect(page.getByRole('button', { name: 'Silence activé' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByText('En silence', { exact: true })).toBeVisible()
    expect(state.silence.until).toBeNull()
  })

  test('Silence_ShouldOfferTheScheduleNextChangeAfterUntilReactivation_WhenAMuteRangeExists', async ({
    page,
  }) => {
    const nextChange = fakeHouseMomentIn(90)
    const state = createFakeBackendState({
      silence: { active: false, until: null, scheduleNextChange: nextChange },
    })
    await installFakeBackend(page, state)

    await page.goto('/')
    await page.getByRole('button', { name: 'Silence', exact: true }).click()
    const options = page.getByRole('dialog', { name: 'Silence' }).getByRole('button')
    await expect(options.nth(1)).toContainText(/^Jusqu’à \d+ h/)
    await expect(options.nth(1)).toContainText('Ensuite, la planification reprend')
    await options.nth(1).click()

    await expect(page.getByRole('button', { name: /^Silence jusqu’à/ })).toBeVisible()
    expect(state.silence.until).toEqual(nextChange)
  })

  test('Home_ShouldShowFourCamerasAndLeadToThemAll_WhenThereAreFourOrMore', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: fiveCameras }))

    await page.goto('/')
    await expect(page.getByRole('article')).toHaveCount(4)
    await page.getByRole('link', { name: 'Voir les 5 caméras' }).click()

    await expect(page).toHaveURL(/\/cameras$/)
    await expect(page.getByRole('heading', { name: 'Caméras' })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(5)
    await expect(page.getByRole('button', { name: 'Couper Cave' })).toBeVisible()
  })

  test('DetectionsTile_ShouldCountTheLastHourAndLeadToTheDetections_WhenTheHomeOpens', async ({
    page,
  }) => {
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({ eventId: 'event-1', occurredAt: recent }),
          makeFakeDetectionEvent({ eventId: 'event-2', occurredAt: recent }),
          makeFakeDetectionEvent({ eventId: 'event-3', occurredAt: old }),
        ],
      }),
    )

    await page.goto('/')
    const tile = page.getByRole('link', { name: /Détections/ })
    await expect(tile).toContainText('2 depuis 1 h')
    // No channel set up yet: the one exception the Notifications tile carries.
    await expect(page.getByRole('link', { name: /Notifications/ })).toContainText('À configurer')

    await tile.click()
    await expect(page).toHaveURL(/\/detections$/)
  })

  test('FirstRun_ShouldOfferAddingACameraFromTheHome_WhenNoCameraIsAddedYet', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))

    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Bienvenue')).toHaveCount(0)
    await page.getByRole('link', { name: 'Ajouter une caméra' }).click()

    await expect(page).toHaveURL(/\/settings\/cameras\/add$/)
    await expect(page.getByRole('heading', { name: 'Ajouter une caméra' })).toBeVisible()
    await page.getByRole('button', { name: 'Retour' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('HubUnreachable_ShouldFillTheScreenThenOpenByItself_WhenVyzioAnswersAgain', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())
    let down = true
    await page.route('**/api/access/state', (route) =>
      down ? route.abort('connectionrefused') : route.fallback(),
    )

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Vyzio ne répond pas' })).toBeVisible()
    await page.getByText('Détails techniques').click()
    await expect(page.getByText(/GET \/api\/access\/state/)).toBeVisible()

    // Nothing to press: the app asks again on its own and opens once Vyzio answers (UI-34).
    down = false
    await expect(page.getByRole('button', { name: 'Couper les caméras' })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('TopBar_ShouldFollowACameraGoingOfflineAndBack_WhenTheHomeStaysOpen', async ({ page }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ displayName: 'Jardin' })] })
    await installFakeBackend(page, state)
    // The page's clock is skipped forward so a poll passes without waiting it out.
    await page.clock.install()
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Couper les caméras' })).toBeVisible()

    state.cameras = state.cameras.map((camera) => ({ ...camera, status: 'offline' }))
    await page.clock.fastForward(8000)
    const alerts = page.getByRole('list', { name: 'Alertes' })
    await expect(alerts.getByText('Jardin ne répond plus')).toBeVisible()

    state.cameras = state.cameras.map((camera) => ({ ...camera, status: 'online' }))
    await page.clock.fastForward(8000)
    await expect(alerts).toHaveCount(0)
  })
})
