import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * WCAG 2.1 A/AA scan (axe-core) of every screen, populated with real content —
 * an empty screen hides the contrast and labelling defects that only show up
 * once badges, forms and lists actually render.
 *
 * Kept separate from `socle-visual.e2e.ts`: that test proves a specific,
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

test.describe('Accessibilite — WCAG 2.1 A/AA', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [
          makeFakeCamera({ id: 'camera-1', displayName: 'Salon' }),
          makeFakeCamera({
            id: 'camera-2',
            displayName: 'Garage',
            status: 'offline',
            connected: false,
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
          {
            eventId: 'evt-1',
            frigateEventId: 'frigate-1',
            lifecycle: 'end',
            camera: 'front_door',
            label: 'person',
            identity: 'Alice',
            profileId: 'profile-1',
            confidence: 0.92,
            occurredAt: new Date().toISOString(),
            hasClip: true,
            hasSnapshot: true,
          },
        ],
      }),
    )
  })

  const routes: [string, string][] = [
    ['/', 'Accueil'],
    ['/history', 'Historique'],
    ['/settings', 'Reglages'],
    ['/settings/cameras', 'Cameras — liste'],
    ['/settings/cameras/ajout', 'Cameras — ajout'],
    ['/settings/cameras/camera-1/detection', 'Camera — detection'],
    ['/settings/cameras/camera-1/conservation', 'Camera — conservation'],
    ['/settings/cameras/camera-1/vie-privee', 'Camera — vie privee'],
    ['/settings/cameras/camera-1/image', 'Camera — image'],
    ['/settings/cameras/camera-1/connexion', 'Camera — connexion'],
    ['/settings/conservation', 'Conservation (installation)'],
    ['/settings/notifications', 'Notifications'],
    ['/settings/detection/personnes', 'Personnes — liste'],
    ['/settings/detection/personnes/ajout', 'Personnes — ajout'],
    ['/settings/detection/personnes/profile-1/identite', 'Personne — identite'],
    ['/settings/detection/personnes/profile-1/photos', 'Personne — photos'],
    ['/settings/detection/personnes/profile-1/cameras', 'Personne — cameras'],
    ['/settings/systeme', 'Systeme'],
  ]

  for (const [path, label] of routes) {
    test(`a11y_When on ${label}_Should have no WCAG A/AA violation`, async ({ page }) => {
      await page.goto(path)
      // Settled network, not a fixed delay: a still-loading page under-reports.
      await page.waitForLoadState('networkidle')

      const violations = await scan(page)
      expect(violations, describeViolations(violations)).toEqual([])
    })
  }
})
