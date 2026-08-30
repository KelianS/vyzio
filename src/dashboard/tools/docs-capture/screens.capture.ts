import fs from 'node:fs'
import path from 'node:path'
import { test, type Page } from '@playwright/test'
import {
  createFakeBackendState,
  installFakeBackend,
  makeFakeCamera,
  makeFakeChannel,
  makeFakeDetectionEvent,
} from '../../tests/e2e/fixtures/fakeBackend'

const OUT = path.resolve(import.meta.dirname, '../../../../docs/assets')

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

const STILLS = path.resolve(import.meta.dirname, 'stills')

/**
 * A stand-in frame, drawn rather than photographed: a screenshot must not pass off an invented
 * scene as something a camera saw.
 */
async function placeholder(page: Page, label: string, width: number, height: number) {
  const helper = await page.context().newPage()
  await helper.setViewportSize({ width, height })
  await helper.setContent(`<body style="margin:0">
    <div style="width:100%;height:100vh;display:grid;place-items:center;font:500 ${Math.round(
      height / 12,
    )}px/1.2 system-ui,sans-serif;color:#cfe0d4;letter-spacing:.02em;text-align:center;
      background:radial-gradient(120% 100% at 30% 0%,#2c5446 0%,#16302a 60%,#0e211d 100%)">
      ${label}
    </div>
  </body>`)
  const image = await helper.screenshot({ type: 'jpeg', quality: 82 })
  await helper.close()
  return image
}

/**
 * Live tiles and detection thumbnails have nothing to show against a fake backend. Drop
 * `<camera-slug>.jpg` in `stills/` to serve a real frame; otherwise they get a drawn stand-in.
 */
async function serveImagery(page: Page) {
  const slugOf = new Map(state.cameras.map((camera) => [camera.id, camera.slug]))
  const jpeg = (route: Parameters<Parameters<Page['route']>[1]>[0], body: Buffer) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body })

  await page.route('**/live/latest.jpg*', async (route, request) => {
    const id = new URL(request.url()).pathname.split('/').at(-3) ?? ''
    const slug = slugOf.get(id) ?? id
    const file = path.join(STILLS, `${slug}.jpg`)
    const name = state.cameras.find((camera) => camera.slug === slug)?.displayName ?? slug
    await jpeg(
      route,
      fs.existsSync(file) ? fs.readFileSync(file) : await placeholder(page, name, 640, 360),
    )
  })

  await page.route('**/api/detection-events/*/{thumbnail,snapshot}', async (route) => {
    await jpeg(route, await placeholder(page, '', 96, 96))
  })
}

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

async function shoot(page: Page, width: number, route: string, name: string) {
  // Measured from a short viewport, so the previous screen's height never inflates this one's.
  await page.setViewportSize({ width, height: 400 })
  await page.goto(route)
  // The screens settle their own async loads; a network idle beat is enough with a fake backend.
  await page.waitForLoadState('networkidle')
  // Cropped to the content: a fixed viewport would frame short screens with dead space.
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight) + 24)
  await page.setViewportSize({ width, height: Math.min(height, 2000) })
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
}

test('desktop screens', async ({ page }) => {
  await installFakeBackend(page, state)
  await serveImagery(page)
  await serveConfiguredAlerts(page)
  await shoot(page, 1280, '/', 'hub')
  await shoot(page, 1280, '/history', 'history')
  await shoot(page, 1280, '/settings/cameras', 'cameras')
  await shoot(page, 1280, '/settings/detection/personnes', 'people')
})

test('phone screens', async ({ page }) => {
  await installFakeBackend(page, state)
  await serveImagery(page)
  await serveConfiguredAlerts(page)
  await shoot(page, 390, '/', 'hub-phone')
})
