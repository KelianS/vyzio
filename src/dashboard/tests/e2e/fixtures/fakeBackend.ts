import type { Page, Route } from '@playwright/test'

export interface FakeCamera {
  id: string
  slug: string
  displayName: string
  sourceType: string
  host: string
  port: number
  username: string | null
  streamPath: string | null
  streamProtocol: string
  status: string
  validationState: string
  isEnabled: boolean
  previewAvailable: boolean
  needsAttention: boolean
  lastReachabilityCheckAt: string | null
  lastSuccessfulFrameAt: string | null
  frigateCameraName: string | null
  vendorFamily: string | null
  privacyModeActive: boolean
  privacyModeSource: 'manual' | 'schedule' | null
  privacyVendorCut: boolean
  ptzSupported: boolean
  privacyStrategy: string
  supportedProtocols: string[]
  verifiedCapabilities: string[]
}

export function makeFakeCamera(overrides: Partial<FakeCamera> = {}): FakeCamera {
  return {
    id: 'camera-1',
    slug: 'front-door',
    displayName: 'Porte d’entrée',
    sourceType: 'rtsp_manual',
    host: '192.168.1.50',
    port: 554,
    username: null,
    streamPath: '/Streaming/Channels/101',
    streamProtocol: 'rtsp',
    status: 'online',
    validationState: 'validated',
    isEnabled: true,
    previewAvailable: true,
    needsAttention: false,
    lastReachabilityCheckAt: new Date().toISOString(),
    lastSuccessfulFrameAt: new Date().toISOString(),
    frigateCameraName: 'front_door',
    vendorFamily: null,
    privacyModeActive: false,
    privacyModeSource: null,
    privacyVendorCut: false,
    ptzSupported: false,
    privacyStrategy: 'none',
    supportedProtocols: ['rtsp'],
    verifiedCapabilities: [],
    ...overrides,
  }
}

export interface FakeBackendState {
  cameras: FakeCamera[]
  /** Des reglages enregistres que la surveillance n'a pas encore repris (ADR-44). */
  pendingChanges: boolean
  restartFails: boolean
  profiles: {
    id: string
    name: string
    category: string
    alertMode: string
    lastSeenAt: string | null
    createdAt: string
  }[]
  notificationChannels: Record<
    string,
    {
      channel: string
      isEnabled: boolean
      hasToken: boolean
      chatId: string | null
      minimumConfidence: number
      allowedLabels: string[]
      activeFromHour: number | null
      activeToHour: number | null
      messageFields: string[]
      mediaMode: string
      cooldownMinutes: number | null
      configuredAt: string | null
      lastTestedAt: string | null
      lastTestStatus: 'success' | 'failure' | null
      lastTestError: string | null
    }
  >
  detectionHistory: {
    eventId: string
    frigateEventId: string
    lifecycle: string
    camera: string
    label: string
    identity: string | null
    profileId: string | null
    confidence: number | null
    occurredAt: string
    hasClip: boolean
    hasSnapshot: boolean
  }[]
  detectionConfig: {
    labels: string[]
    motionSensitivity: 'high' | 'medium' | 'low'
    motionSensitivityPinned: boolean
    detectStreamId: string | null
    continuousDaysOverride: number | null
    motionDaysOverride: number | null
    eventClipDaysOverride: number | null
  }
  recordingSettings: {
    continuous: { days: number; default: number }
    motion: { days: number; default: number }
    eventClip: { days: number; default: number }
    maxDays: number
  }
}

let nextId = 1

const ONE_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
  'base64',
)

export function createFakeBackendState(
  overrides: Partial<FakeBackendState> = {},
): FakeBackendState {
  return {
    cameras: [makeFakeCamera()],
    pendingChanges: false,
    restartFails: false,
    profiles: [],
    notificationChannels: {},
    detectionHistory: [],
    detectionConfig: {
      labels: ['person'],
      motionSensitivity: 'medium',
      motionSensitivityPinned: false,
      detectStreamId: 'sub',
      continuousDaysOverride: null,
      motionDaysOverride: null,
      eventClipDaysOverride: null,
    },
    // Valeurs livrees par Vyzio (ADR-39).
    recordingSettings: {
      continuous: { days: 0, default: 0 },
      motion: { days: 7, default: 7 },
      eventClip: { days: 14, default: 14 },
      maxDays: 365,
    },
    ...overrides,
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

/**
 * Installs an in-memory fake backend for the whole app: every screen fetches through this
 * instead of a real API. Kept as one router (not per-test literal payloads) so a flow like
 * "discover -> create -> verify -> appears in sidebar" reflects consistently across requests.
 */
export async function installFakeBackend(
  page: Page,
  state: FakeBackendState = createFakeBackendState(),
) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const path = url.pathname
    const postData = request.postDataJSON?.() as Record<string, unknown> | undefined

    // --- Hub ---
    if (path === '/api/hub/overview' && method === 'GET') {
      return json(route, {
        systemHealthy: true,
        recentEvents: state.detectionHistory.slice(0, 5),
        profiles: state.profiles,
        notifications: { telegramConfigured: false, sentCount: 0, lastSentAt: null },
        warnings: [],
      })
    }

    // --- System ---
    if (path === '/api/system/stats' && method === 'GET') {
      return json(route, {
        status: 'active',
        storage: { totalGb: 500, usedGb: 120, freeGb: 380 },
        cameras: state.cameras.map((c) => ({ camera: c.slug, fps: 10 })),
        detection: { hardware: 'cpu', targetFps: 5 },
        pendingChanges: state.pendingChanges,
      })
    }

    // --- Cameras ---
    if (path === '/api/cameras' && method === 'GET') {
      return json(route, state.cameras)
    }
    if (path === '/api/cameras' && method === 'POST') {
      const camera = makeFakeCamera({
        id: `camera-${nextId++}`,
        displayName: (postData?.displayName as string) ?? 'Nouvelle caméra',
        host: (postData?.host as string) ?? '192.168.1.99',
        port: (postData?.port as number) ?? 554,
        streamPath: (postData?.streamPath as string) ?? null,
        validationState: 'validated',
        status: 'online',
      })
      state.cameras.push(camera)
      return json(route, camera)
    }
    if (path === '/api/cameras/discovery' && method === 'POST') {
      return json(route, [
        {
          displayName: 'Caméra détectée',
          host: '192.168.1.77',
          port: 554,
          sourceType: 'rtsp_manual',
          streamPath: '/Streaming/Channels/101',
          rtspActive: true,
          discoverySource: 'onvif',
          note: null,
          macAddress: 'AA:BB:CC:DD:EE:FF',
          isSupported: true,
          qualification: 'supported',
          supportLevel: 'full',
          vendorFamily: null,
          qualificationReasons: [],
          vendorDocumentation: null,
          technicalDetails: {
            resolvedHostName: null,
            detectedPorts: [{ protocol: 'onvif', label: 'ONVIF', port: 80 }],
            rtspPathsDetected: ['/Streaming/Channels/101'],
            capabilities: [],
          },
        },
      ])
    }
    if (path === '/api/cameras/vendor-assistance' && method === 'POST') {
      return json(route, null)
    }
    if (path === '/api/cameras/verify-draft' && method === 'POST') {
      return json(route, {
        cameraId: 'draft',
        displayName: (postData?.displayName as string) ?? 'Nouvelle caméra',
        status: 'online',
        validationState: 'draft',
        connected: true,
        previewAvailable: true,
        needsAttention: false,
        guidance: 'Flux valide. Vous pouvez maintenant ajouter cette caméra.',
        lastReachabilityCheckAt: new Date().toISOString(),
        lastSuccessfulFrameAt: new Date().toISOString(),
      })
    }
    if (path === '/api/cameras/apply-configuration' && method === 'POST') {
      // Comme le vrai : un redemarrage reussi vide l'attente, un echec la laisse.
      if (state.restartFails) {
        return json(route, {
          applied: false,
          message: 'La surveillance n’a pas redémarré.',
          cameraCount: state.cameras.length,
        })
      }
      state.pendingChanges = false
      return json(route, {
        applied: true,
        message: 'Configuration appliquée',
        cameraCount: state.cameras.length,
      })
    }
    if (path === '/api/cameras/privacy/batch-toggle' && method === 'POST') {
      const ids = (postData?.cameraIds as string[]) ?? []
      const active = Boolean(postData?.active)
      state.cameras = state.cameras.map((c) =>
        ids.includes(c.id) ? { ...c, privacyModeActive: active } : c,
      )
      return json(
        route,
        state.cameras.filter((c) => ids.includes(c.id)),
      )
    }

    const cameraMatch = path.match(/^\/api\/cameras\/([^/]+)(\/.*)?$/)
    if (cameraMatch) {
      const [, cameraId, rest] = cameraMatch
      const camera = state.cameras.find((c) => c.id === cameraId)

      if (rest?.startsWith('/live/latest.jpg')) {
        return route.fulfill({ status: 200, contentType: 'image/gif', body: ONE_PIXEL_GIF })
      }
      if (!rest && method === 'GET') {
        return camera ? json(route, camera) : json(route, { message: 'not found' }, 404)
      }
      if (!rest && method === 'PUT') {
        const updated = makeFakeCamera({
          ...camera,
          ...postData,
          id: cameraId,
        } as Partial<FakeCamera>)
        state.cameras = state.cameras.map((c) => (c.id === cameraId ? updated : c))
        return json(route, updated)
      }
      if (rest === '/status' && method === 'GET') {
        return json(route, {
          cameraId,
          displayName: camera?.displayName ?? cameraId,
          status: camera?.status ?? 'online',
          validationState: camera?.validationState ?? 'validated',
          connected: camera?.status !== 'offline',
          previewAvailable: true,
          needsAttention: false,
          guidance: null,
          lastReachabilityCheckAt: new Date().toISOString(),
          lastSuccessfulFrameAt: new Date().toISOString(),
        })
      }
      if (rest === '/verify' && method === 'POST') {
        return json(route, {
          cameraId,
          displayName: camera?.displayName ?? cameraId,
          status: 'online',
          validationState: 'validated',
          connected: true,
          previewAvailable: true,
          needsAttention: false,
          guidance: 'Vérification terminée.',
          lastReachabilityCheckAt: new Date().toISOString(),
          lastSuccessfulFrameAt: new Date().toISOString(),
        })
      }
      if (rest === '/privacy/toggle' && method === 'POST') {
        if (camera) camera.privacyModeActive = Boolean(postData?.active)
        return json(route, camera)
      }
      if (rest === '/capabilities' && method === 'GET') {
        return json(route, [])
      }
      if (rest === '/privacy/schedules' && method === 'GET') {
        return json(route, [])
      }
      if (rest === '/detection-config') {
        if (method === 'PUT') {
          const body = route.request().postDataJSON() as Record<string, unknown>
          state.detectionConfig = { ...state.detectionConfig, ...body }
          state.pendingChanges = true
        }
        const config = state.detectionConfig
        return json(route, {
          cameraId,
          labels: config.labels,
          availableLabels: ['person', 'car'],
          retention: {
            continuous: {
              override: config.continuousDaysOverride,
              installation: state.recordingSettings.continuous.days,
              effective: config.continuousDaysOverride ?? state.recordingSettings.continuous.days,
            },
            motion: {
              override: config.motionDaysOverride,
              installation: state.recordingSettings.motion.days,
              effective: config.motionDaysOverride ?? state.recordingSettings.motion.days,
            },
            eventClip: {
              override: config.eventClipDaysOverride,
              installation: state.recordingSettings.eventClip.days,
              effective: config.eventClipDaysOverride ?? state.recordingSettings.eventClip.days,
            },
            maxDays: state.recordingSettings.maxDays,
          },
          motionSensitivity: config.motionSensitivity,
          motionSensitivityPinned: config.motionSensitivityPinned,
          streams: [
            { id: 'main', ordinal: 0, width: 1920, height: 1080, fps: 15 },
            { id: 'sub', ordinal: 1, width: 640, height: 360, fps: 10 },
          ],
          detectStreamId: config.detectStreamId,
        })
      }
      if (rest === '/image-settings' && method === 'GET') {
        return json(route, {
          brightness: 50,
          contrast: 50,
          saturation: 50,
          sharpness: 50,
          irCutMode: 'auto',
        })
      }
      if (path.endsWith('/thumbnail')) {
        return json(route, {}, 404)
      }
      if (method === 'DELETE') {
        state.cameras = state.cameras.filter((c) => c.id !== cameraId)
        return json(route, { deleted: true, message: 'Caméra supprimée', configPath: '/config' })
      }
    }

    // --- Detection labels ---
    if (path === '/api/detection-labels/camera' || path === '/api/detection-labels/notifications') {
      return json(route, [
        { value: 'person', displayName: 'Personne', emoji: '🧑' },
        { value: 'car', displayName: 'Voiture', emoji: '🚗' },
      ])
    }

    // --- Recording settings (ADR-39) ---
    if (path === '/api/settings/recording') {
      if (method === 'PUT') {
        const body = route.request().postDataJSON() as Record<string, number>
        state.recordingSettings = {
          continuous: { ...state.recordingSettings.continuous, days: body.continuousDays },
          motion: { ...state.recordingSettings.motion, days: body.motionDays },
          eventClip: { ...state.recordingSettings.eventClip, days: body.eventClipDays },
          maxDays: state.recordingSettings.maxDays,
        }
        state.pendingChanges = true
      }
      return json(route, state.recordingSettings)
    }

    // --- Profiles ---
    if (path === '/api/profiles' && method === 'GET') {
      return json(route, state.profiles)
    }
    if (path === '/api/profiles' && method === 'POST') {
      const profile = {
        id: `profile-${nextId++}`,
        name: (postData?.name as string) ?? 'Nouveau profil',
        category: (postData?.category as string) ?? 'family',
        alertMode: (postData?.alertMode as string) ?? 'always',
        lastSeenAt: null,
        createdAt: new Date().toISOString(),
      }
      state.profiles.push(profile)
      return json(route, profile)
    }
    const profileMatch = path.match(/^\/api\/profiles\/([^/]+)(\/.*)?$/)
    if (profileMatch) {
      const [, profileId, rest] = profileMatch
      if (rest === '/photos' && method === 'GET') return json(route, [])
      if (rest === '/camera-links' && method === 'GET') return json(route, [])
      if (!rest && method === 'PUT') {
        const existing = state.profiles.find((p) => p.id === profileId)
        const updated = {
          id: profileId,
          name: (postData?.name as string) ?? existing?.name ?? '',
          category: (postData?.category as string) ?? existing?.category ?? 'family',
          alertMode: (postData?.alertMode as string) ?? existing?.alertMode ?? 'always',
          lastSeenAt: existing?.lastSeenAt ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }
        state.profiles = state.profiles.map((p) => (p.id === profileId ? updated : p))
        return json(route, updated)
      }
      if (!rest && method === 'DELETE') {
        state.profiles = state.profiles.filter((p) => p.id !== profileId)
        return json(route, {})
      }
    }
    if (path === '/api/profiles/resync-face-library' && method === 'POST') {
      return json(route, { synced: 0 })
    }

    // --- Notifications ---
    const notifConfigMatch = path.match(/^\/api\/notifications\/settings\/([^/]+)(\/test)?$/)
    if (notifConfigMatch) {
      const [, channel, isTest] = notifConfigMatch
      if (isTest && method === 'POST') {
        return json(route, { success: true, errorMessage: null })
      }
      if (method === 'GET') {
        const config = state.notificationChannels[channel]
        return config ? json(route, config) : json(route, { message: 'not found' }, 404)
      }
      if (method === 'PUT') {
        const existing = state.notificationChannels[channel]
        const config = {
          channel,
          isEnabled: Boolean(postData?.isEnabled),
          hasToken: Boolean(postData?.botToken) || Boolean(existing?.hasToken),
          chatId: (postData?.chatId as string) ?? existing?.chatId ?? null,
          minimumConfidence: (postData?.minimumConfidence as number) ?? 0.75,
          allowedLabels: (postData?.allowedLabels as string[]) ?? [
            'person_unknown',
            'person_known',
          ],
          activeFromHour: (postData?.activeFromHour as number | null) ?? null,
          activeToHour: (postData?.activeToHour as number | null) ?? null,
          messageFields: (postData?.messageFields as string[]) ?? ['camera', 'time', 'label'],
          mediaMode: (postData?.mediaMode as string) ?? 'clip_or_photo',
          cooldownMinutes: (postData?.cooldownMinutes as number | null) ?? null,
          configuredAt: new Date().toISOString(),
          lastTestedAt: existing?.lastTestedAt ?? null,
          lastTestStatus: existing?.lastTestStatus ?? null,
          lastTestError: existing?.lastTestError ?? null,
        }
        state.notificationChannels[channel] = config
        return json(route, config)
      }
      if (method === 'DELETE') {
        delete state.notificationChannels[channel]
        return json(route, true)
      }
    }
    if (path.startsWith('/api/notifications/log/') && method === 'GET') {
      return json(route, [])
    }

    // --- Detection history ---
    if (path === '/api/detection-events/history' && method === 'GET') {
      const limit = Number(url.searchParams.get('limit') ?? '20')
      const label = url.searchParams.get('label')
      const items = label
        ? state.detectionHistory.filter((e) => e.label === label)
        : state.detectionHistory
      return json(route, {
        items: items.slice(0, limit),
        total: items.length,
        page: Number(url.searchParams.get('page') ?? '1'),
        limit,
        totalPages: Math.max(1, Math.ceil(items.length / limit)),
      })
    }
    if (path.match(/^\/api\/detection-events\/[^/]+\/identity$/) && method === 'PATCH') {
      return json(route, {})
    }

    return json(route, { message: `unmocked: ${method} ${path}` }, 404)
  })
}
