import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeChannel,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

/**
 * WCAG 2.1 A/AA scan (axe-core) of every screen, populated with real content:
 * an empty screen hides the contrast and labelling defects that only show up
 * once badges, forms and lists actually render.
 *
 * Kept separate from `socle_visual.e2e.ts`: that test proves a specific,
 * previously-broken contrast case stays fixed (with a before/after check);
 * this one sweeps every screen for whatever axe's ruleset can catch, seeded
 * or not.
 */
async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations
}

function describeViolations(violations: { id: string; help: string; nodes: { html: string }[] }[]) {
  return violations
    .map((v) => `${v.id} (${v.help}):\n${v.nodes.map((n) => '  ' + n.html).join('\n')}`)
    .join('\n\n')
}

test.describe('Accessibility, WCAG 2.1 A/AA', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [
          makeFakeCamera({ id: 'camera-1', displayName: 'Salon' }),
          makeFakeCamera({
            id: 'camera-2',
            displayName: 'Garage',
            // Unreachable: the fake backend derives the connection from it (`status !== 'offline'`).
            status: 'offline',
          }),
        ],
        profiles: [
          {
            id: 'profile-1',
            name: 'Alice',
            category: 'family',
            alertMode: 'always',
            lastSeenAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        detectionHistory: [
          makeFakeDetectionEvent({
            eventId: 'evt-1',
            identity: 'Alice',
            profileId: 'profile-1',
            hasClip: true,
          }),
        ],
        notificationChannels: { telegram: makeFakeChannel('telegram') },
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
    '/settings/cameras/camera-1/detection',
    '/settings/cameras/camera-1/retention',
    '/settings/cameras/camera-1/privacy',
    '/settings/cameras/camera-1/image',
    '/settings/cameras/camera-1/connection',
    '/settings/retention',
    '/settings/notifications',
    '/settings/notifications/telegram',
    '/settings/schedule',
    '/settings/schedule/rule-1',
    '/settings/access',
    '/settings/detection/people',
    '/settings/detection/people/add',
    '/settings/detection/people/profile-1/identity',
    '/settings/detection/people/profile-1/photos',
    '/settings/detection/people/profile-1/cameras',
    '/settings/hardware',
  ]

  for (const path of routes) {
    test(`Screen_ShouldPassTheWcagScan_WhenFilledWithContent (${path})`, async ({ page }) => {
      await page.goto(path)
      // Settled network, not a fixed delay: a still-loading page under-reports.
      await page.waitForLoadState('networkidle')

      const violations = await scan(page)
      expect(violations, describeViolations(violations)).toEqual([])
    })
  }
})
