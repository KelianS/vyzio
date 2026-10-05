import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import {
  createFakeBackendState,
  installFakeBackend,
  makeFakeCamera,
  makeFakeChannel,
  makeFakeDetectionEvent,
} from '../../tests/e2e/fixtures/fake_backend'
import { fullPageScreenshot } from '../../tests/e2e/fixtures/full_page_screenshot'

const OUT = path.resolve(import.meta.dirname, '../../../../docs/assets')
// A screen showing camera scenes is a JPEG: as a PNG, the photos weigh several times more.
const JPEG_QUALITY = 82

// Fixed so a re-capture only changes what the interface changed, never the clock.
const NOW = new Date('2026-05-14T18:32:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

const state = createFakeBackendState({
  cameras: [
    makeFakeCamera({
      id: 'camera-1',
      slug: 'porte-entree',
      displayName: 'Porte d’entrée',
      ptzSupported: true,
      verifiedCapabilities: ['ptz'],
    }),
    makeFakeCamera({
      id: 'camera-2',
      slug: 'jardin',
      displayName: 'Jardin',
      host: '192.168.1.42',
    }),
    makeFakeCamera({
      id: 'camera-3',
      slug: 'garage',
      displayName: 'Garage',
      host: '192.168.1.43',
      privacyModeActive: true,
      privacyModeSource: 'schedule',
    }),
    makeFakeCamera({
      id: 'camera-4',
      slug: 'allee',
      displayName: 'Allée',
      host: '192.168.1.44',
    }),
  ],
  profiles: [
    {
      id: 'profile-1',
      name: 'Camille',
      category: 'family',
      alertMode: 'never',
      lastSeenAt: hoursAgo(2),
      createdAt: hoursAgo(900),
    },
    {
      id: 'profile-2',
      name: 'Facteur',
      category: 'staff',
      alertMode: 'always',
      lastSeenAt: hoursAgo(28),
      createdAt: hoursAgo(700),
    },
  ],
  notificationChannels: { telegram: makeFakeChannel('telegram') },
  detectionHistory: [
    makeFakeDetectionEvent({
      eventId: 'e1',
      cameraName: 'Porte d’entrée',
      identity: 'Camille',
      profileId: 'profile-1',
      occurredAt: hoursAgo(2),
    }),
    makeFakeDetectionEvent({
      eventId: 'e2',
      cameraName: 'Jardin',
      camera: 'jardin',
      confidence: 0.71,
      occurredAt: hoursAgo(5),
    }),
    makeFakeDetectionEvent({
      eventId: 'e3',
      cameraName: 'Porte d’entrée',
      identity: 'Facteur',
      profileId: 'profile-2',
      hasClip: true,
      occurredAt: hoursAgo(28),
    }),
  ],
})

/** The fake backend reports no channel whatever the state holds; the capture shows one in place. */
async function serveConfiguredAlerts(page: Page) {
  await page.route('**/api/hub/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        systemHealthy: true,
        recentEvents: state.detectionHistory.slice(0, 5),
        profiles: state.profiles,
        notifications: { activeChannels: 1, sentCount: 12, lastSentAt: hoursAgo(2) },
        warnings: [],
      }),
    })
  })
}

async function open(page: Page, route: string) {
  // A short viewport, so the full-page shot ends where the content does, not where the screen does.
  await page.setViewportSize({ width: 390, height: 400 })
  await page.goto(route)
  // The screens settle their own async loads; a network idle beat is enough with a fake backend.
  await page.waitForLoadState('networkidle')
}

// The phone viewport: that is the form factor the interface is designed for (SPECS 7.2).
test('phone screens', async ({ page }) => {
  await installFakeBackend(page, state)
  await serveConfiguredAlerts(page)
  const shoot = async (route: string, file: string, quality?: number) => {
    await open(page, route)
    await fullPageScreenshot(page, { path: path.join(OUT, file), quality })
  }

  await shoot('/', 'hub.jpg', JPEG_QUALITY)
  await shoot('/history', 'history.jpg', JPEG_QUALITY)
  await shoot('/settings/cameras', 'cameras.png')
  await shoot('/settings/detection/personnes', 'people.png')

  await open(page, '/')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Porte d’entrée' }).click()
  await expect(page.getByRole('img', { name: 'Porte d’entrée' }).last()).toBeVisible()
  await page.screenshot({ path: path.join(OUT, 'live.jpg'), quality: JPEG_QUALITY })
})
