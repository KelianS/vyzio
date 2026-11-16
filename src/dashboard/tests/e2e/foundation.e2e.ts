import { test, expect } from '@playwright/test'
import {
  createFakeBackendState,
  installFakeBackend,
  makeFakeCamera,
  makeFakeChannel,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'
import { probeFoundation } from './fixtures/foundation_probe'

test.use({ viewport: { width: 390, height: 844 } })

const GROUND = 'rgb(16, 20, 18)'
const FOUR_SIZES = ['13px', '15px', '17px', '26px']

const routes = [
  '/',
  '/cameras',
  '/detections',
  '/cameras/camera-1',
  '/cameras/camera-1?tab=detections',
  '/cameras/camera-2',
  '/settings',
  '/settings/cameras',
  '/settings/cameras/add',
  '/settings/cameras/add?step=access',
  '/settings/cameras/camera-1/connection',
  '/settings/cameras/camera-1/privacy',
  '/settings/cameras/camera-1/detection',
  '/settings/cameras/camera-1/image',
  '/settings/cameras/camera-1/retention',
  '/settings/detection/people',
  '/settings/detection/people/add',
  '/settings/detection/people/profile-1/identity',
  '/settings/detection/people/profile-1/photos',
  '/settings/detection/people/profile-1/cameras',
  '/settings/schedule',
  '/settings/schedule/rule-1',
  '/settings/schedule/add?kind=mute_notifications',
  '/settings/notifications',
  '/settings/notifications/telegram',
  '/settings/notifications/add',
  '/settings/retention',
  '/settings/access',
  '/settings/hardware',
]

test.describe('Redesign foundation', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [
          makeFakeCamera({
            id: 'camera-1',
            displayName: 'Salon',
            ptzSupported: true,
            verifiedCapabilities: ['ptz'],
          }),
          makeFakeCamera({ id: 'camera-2', displayName: 'Garage', status: 'offline' }),
          makeFakeCamera({ id: 'camera-3', displayName: 'Cave', privacyModeActive: true }),
        ],
        notificationChannels: { telegram: makeFakeChannel('telegram') },
        profiles: [
          {
            id: 'profile-1',
            name: 'Alice',
            category: 'family',
            alertMode: 'always',
            lastSeenAt: '2026-01-01T00:00:00Z',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        detectionHistory: [makeFakeDetectionEvent({ eventId: 'evt-1', hasClip: true })],
        scheduleRules: [
          {
            id: 'rule-1',
            kind: 'privacy',
            targetIds: ['camera-1'],
            daysOfWeek: [1, 2],
            startTime: '22:00',
            endTime: '07:00',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
  })

  test('Row_ShouldRingWhereTheKeyboardStands_WhenAHelpRowOrAPositionTakesTheFocus', async ({
    page,
  }) => {
    await page.goto('/settings/retention')
    const help = page.locator('summary', { hasText: 'Quand la place est-elle vraiment libérée ?' })
    await help.focus()
    await expect(help).toHaveCSS('box-shadow', /inset/)

    await page.goto('/cameras/camera-1')
    const add = page.getByRole('button', { name: /Ajouter/ })
    await add.focus()
    await expect(add.locator('span').first()).not.toHaveCSS('box-shadow', 'none')
  })

  const marks = [
    { name: 'Salon', id: 'camera-1', mark: 'En marche' },
    { name: 'Cave', id: 'camera-3', mark: 'Coupée' },
    { name: 'Garage', id: 'camera-2', mark: 'Hors ligne' },
  ]

  for (const { name, id, mark } of marks) {
    test(`CameraMark_ShouldBeTheSameBesideItsNameOnEveryScreen_WhenTheCameraIs (${mark})`, async ({
      page,
    }) => {
      await page.goto('/')
      await expect(page.getByRole('img', { name: mark }).first()).toBeVisible()

      await page.goto(`/cameras/${id}`)
      await expect(page.getByRole('banner').getByRole('img', { name: mark })).toBeVisible()

      await page.goto('/settings/cameras')
      await expect(
        page.getByRole('link', { name: new RegExp(name) }).getByRole('img', { name: mark }),
      ).toBeVisible()

      await page.goto(`/settings/cameras/${id}/connection`)
      await expect(page.getByRole('banner').getByRole('img', { name: mark })).toBeVisible()
    })
  }

  for (const path of routes) {
    test(`Screen_ShouldBeDarkInOneFontAtFourSizesWithControlsAFingerReaches_WhenItRenders (${path})`, async ({
      page,
    }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const report = await probeFoundation(page)

      expect(report.ground).toBe(GROUND)
      expect(report.fonts).toEqual(['Inter Variable'])
      expect(FOUR_SIZES).toEqual(expect.arrayContaining(report.sizes))
      expect(report.smallControls).toEqual([])
    })
  }
})
