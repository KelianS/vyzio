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

/** A detection as the screens read it: the id is Frigate's, Vyzio holds none of its own (ADR-49). */
export interface FakeDetectionEvent {
  eventId: string
  camera: string
  cameraName: string
  label: string
  identity: string | null
  profileId: string | null
  confidence: number | null
  occurredAt: string
  hasClip: boolean
  hasSnapshot: boolean
  mediaExpired: boolean
}

export function makeFakeDetectionEvent(
  overrides: Partial<FakeDetectionEvent> = {},
): FakeDetectionEvent {
  return {
    eventId: 'event-1',
    camera: 'front_door',
    cameraName: 'front door',
    label: 'person',
    identity: null,
    profileId: null,
    confidence: 0.92,
    occurredAt: new Date().toISOString(),
    hasClip: false,
    hasSnapshot: true,
    mediaExpired: false,
    ...overrides,
  }
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

/** Mirrors the backend channel catalogue: a channel declares what it needs and what it can render. */
export interface FakeChannelListening {
  listening: boolean
  since: string | null
  interruptedAt: string | null
  reason: string | null
}

export interface FakeCommandJournalEntry {
  id: string
  verb: string
  outcome: 'succeeded' | 'failed' | 'rejected'
  receivedAt: string
  errorMessage: string | null
}

export interface FakeChannelConfig {
  channel: string
  displayName: string
  isEnabled: boolean
  isConfigured: boolean
  credentials: { field: string; secret: boolean; isSet: boolean; value: string | null }[]
  capabilities: {
    photo: boolean
    video: boolean
    groupedMedia: boolean
    buttons: boolean
    usefulTextLength: number
  }
  acceptsCommands: boolean
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

const CHANNEL_CATALOGUE: Record<
  string,
  { displayName: string; credentials: { field: string; secret: boolean }[] }
> = {
  telegram: {
    displayName: 'Telegram',
    credentials: [
      { field: 'bot_token', secret: true },
      { field: 'chat_id', secret: false },
    ],
  },
  discord: {
    displayName: 'Discord',
    credentials: [
      { field: 'bot_token', secret: true },
      { field: 'chat_id', secret: false },
    ],
  },
}

/** Un canal deja en place, pour partir d'un ecran configure sans rejouer le parcours. */
export function makeFakeChannel(
  channel: string,
  overrides: Partial<FakeChannelConfig> = {},
): FakeChannelConfig {
  const base = unconfiguredChannel(channel)
  return {
    ...base,
    isEnabled: true,
    isConfigured: true,
    credentials: base.credentials.map((credential) => ({ ...credential, isSet: true })),
    configuredAt: new Date().toISOString(),
    ...overrides,
  }
}

function unconfiguredChannel(channel: string): FakeChannelConfig {
  return {
    channel,
    displayName: CHANNEL_CATALOGUE[channel].displayName,
    isEnabled: false,
    isConfigured: false,
    credentials: CHANNEL_CATALOGUE[channel].credentials.map((credential) => ({
      ...credential,
      isSet: false,
      value: null,
    })),
    capabilities: {
      photo: true,
      video: true,
      groupedMedia: true,
      buttons: channel === 'telegram',
      usefulTextLength: 1024,
    },
    acceptsCommands: true,
    minimumConfidence: 0.75,
    allowedLabels: ['person_unknown', 'person_known'],
    activeFromHour: null,
    activeToHour: null,
    messageFields: ['camera', 'time', 'label', 'confidence', 'snapshot'],
    mediaMode: 'clip_or_photo',
    cooldownMinutes: null,
    configuredAt: null,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
  }
}

export interface FakeBackendState {
  cameras: FakeCamera[]
  /** Ou en est l'installation vis-a-vis de son mot de passe, et ce navigateur vis-a-vis d'elle. */
  access: { installed: boolean; signedIn: boolean }
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
  notificationChannels: Record<string, FakeChannelConfig>
  /** L'etat de la boucle entrante d'un canal, et la trace de ce qu'on lui a demande (ADR-52). */
  channelListening: Record<string, FakeChannelListening>
  commandJournal: Record<string, FakeCommandJournalEntry[]>
  detectionHistory: FakeDetectionEvent[]
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
  /** Le pilotage d'une camera : ses positions enregistrees, et si elle sait ou elle est (ADR-25). */
  ptz: {
    presets: {
      presetId: number
      label: string
      native: boolean
      stepsX: number | null
      stepsY: number | null
      configured: boolean
    }[]
    calibrated: boolean
    currentPosition: { x: number; y: number } | null
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
    // Installee et deverrouillee par defaut : chaque test franchirait sinon la meme porte (ADR-54).
    access: { installed: true, signedIn: true },
    pendingChanges: false,
    restartFails: false,
    profiles: [],
    notificationChannels: {},
    channelListening: {},
    commandJournal: {},
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
    ptz: { presets: [], calibrated: true, currentPosition: { x: 0, y: 0 } },
    ...overrides,
  }
}

/** Le mot de passe de l'installation feinte : les tests le tapent, rien d'autre ne le connait. */
export const FAKE_PASSWORD = 'mot-de-passe-de-test'

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

    // --- Acces (ADR-54) ---
    if (path === '/api/access/state' && method === 'GET') {
      return json(route, { installed: state.access.installed, minimumPasswordLength: 8 })
    }

    if (path === '/api/access/session' && method === 'GET') {
      return state.access.signedIn
        ? json(route, { role: 'owner', expiresAt: '2027-01-01T00:00:00Z' })
        : json(route, { error: 'unauthorized' }, 401)
    }

    if (path === '/api/access/account' && method === 'POST') {
      state.access = { installed: true, signedIn: true }
      return json(route, { role: 'owner', expiresAt: '2027-01-01T00:00:00Z' })
    }

    if (path === '/api/access/session' && method === 'POST') {
      const password = (postData?.password as string | undefined) ?? ''
      if (password !== FAKE_PASSWORD) return json(route, { error: 'unauthorized' }, 401)

      state.access = { ...state.access, signedIn: true }
      return json(route, { role: 'owner', expiresAt: '2027-01-01T00:00:00Z' })
    }

    if (path.startsWith('/api/access/session') && method === 'DELETE') {
      state.access = { ...state.access, signedIn: false }
      return json(route, null, 204)
    }

    if (path === '/api/access/sessions' && method === 'DELETE') {
      state.access = { ...state.access, signedIn: false }
      return json(route, { closed: 2 })
    }

    // Passe cette ligne, tout exige une session — comme l'API, sinon le harnais testerait
    // une application que personne ne fait tourner (ADR-54).
    if (!state.access.signedIn) return json(route, { error: 'unauthorized' }, 401)

    // --- Hub ---
    if (path === '/api/hub/overview' && method === 'GET') {
      return json(route, {
        systemHealthy: true,
        recentEvents: state.detectionHistory.slice(0, 5),
        profiles: state.profiles,
        notifications: { activeChannels: 0, sentCount: 0, lastSentAt: null },
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
      // Comme le vrai : le catalogue a change, la surveillance ne l'a pas repris.
      state.pendingChanges = true
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
        state.pendingChanges = true
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
      // --- Pilotage (PTZ) ---
      if (rest === '/ptz/presets' && method === 'GET') {
        return json(route, state.ptz)
      }
      if (rest === '/ptz/step' && method === 'POST') {
        state.ptz.currentPosition = null
        return json(route, {})
      }
      if (rest === '/ptz/calibrate' && method === 'POST') {
        state.ptz.calibrated = true
        state.ptz.currentPosition = { x: 0, y: 0 }
        return json(route, {})
      }
      if (rest === '/ptz/preset/goto' && method === 'POST') {
        const target = state.ptz.presets.find((p) => p.presetId === postData?.presetId)
        state.ptz.currentPosition = target ? { x: target.stepsX ?? 0, y: target.stepsY ?? 0 } : null
        return json(route, {})
      }
      if (rest === '/ptz/preset/save' && method === 'POST') {
        // Comme le vrai : sans reference, la position courante est inconnue, rien ne s'enregistre.
        if (!state.ptz.calibrated) return json(route, { message: 'not_calibrated' }, 409)
        const presetId = Number(postData?.presetId)
        const position = state.ptz.currentPosition ?? { x: 0, y: 0 }
        state.ptz.presets = [
          ...state.ptz.presets.filter((p) => p.presetId !== presetId),
          {
            presetId,
            label: `Position ${presetId}`,
            native: false,
            stepsX: position.x,
            stepsY: position.y,
            configured: true,
          },
        ]
        return json(route, {})
      }
      if (rest?.startsWith('/ptz/presets/') && rest.endsWith('/snapshot')) {
        return json(route, {})
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
        state.pendingChanges = true
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
    if (path === '/api/notifications/channels' && method === 'GET') {
      return json(
        route,
        Object.keys(CHANNEL_CATALOGUE).map((channel) => {
          const config = state.notificationChannels[channel]
          return {
            channel,
            displayName: CHANNEL_CATALOGUE[channel].displayName,
            isConfigured: config?.isConfigured ?? false,
            isEnabled: config?.isEnabled ?? false,
            acceptsCommands: true,
          }
        }),
      )
    }
    const notifConfigMatch = path.match(/^\/api\/notifications\/settings\/([^/]+)(\/test)?$/)
    if (notifConfigMatch) {
      const [, channel, isTest] = notifConfigMatch
      if (!CHANNEL_CATALOGUE[channel]) {
        return json(route, { detail: `Canal de notification inconnu : ${channel}.` }, 400)
      }
      if (isTest && method === 'POST') {
        return json(route, { success: true, errorMessage: null })
      }
      if (method === 'GET') {
        // Un canal jamais configure a quand meme une forme : c'est l'ecran d'ajout.
        return json(route, state.notificationChannels[channel] ?? unconfiguredChannel(channel))
      }
      if (method === 'PUT') {
        const existing = state.notificationChannels[channel] ?? unconfiguredChannel(channel)
        const submitted = (postData?.credentials ?? {}) as Record<string, string>
        const credentials = existing.credentials.map((credential) => {
          const value = submitted[credential.field]?.trim()
          if (!value) return credential
          return { ...credential, isSet: true, value: credential.secret ? null : value }
        })
        const config: FakeChannelConfig = {
          ...existing,
          isEnabled: Boolean(postData?.isEnabled),
          credentials,
          isConfigured: credentials.every((credential) => credential.isSet),
          minimumConfidence: (postData?.minimumConfidence as number) ?? existing.minimumConfidence,
          allowedLabels: (postData?.allowedLabels as string[]) ?? existing.allowedLabels,
          activeFromHour: (postData?.activeFromHour as number | null) ?? null,
          activeToHour: (postData?.activeToHour as number | null) ?? null,
          messageFields: (postData?.messageFields as string[]) ?? existing.messageFields,
          mediaMode: (postData?.mediaMode as string) ?? existing.mediaMode,
          cooldownMinutes: (postData?.cooldownMinutes as number | null) ?? null,
          configuredAt: new Date().toISOString(),
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
    const commandsMatch = path.match(
      /^\/api\/notifications\/settings\/([^/]+)\/(pairing|listening|commands)$/,
    )
    if (commandsMatch) {
      const [, channel, subject] = commandsMatch
      if (subject === 'listening' && method === 'GET') {
        return json(route, {
          channel,
          ...(state.channelListening[channel] ?? {
            listening: false,
            since: null,
            interruptedAt: null,
            reason: null,
          }),
        })
      }
      if (subject === 'commands' && method === 'GET') {
        return json(route, state.commandJournal[channel] ?? [])
      }
      if (subject === 'pairing') {
        // Aucun appairage n'est simule : l'ecran doit tenir sur l'etat le plus nu.
        if (method === 'DELETE') return json(route, true)
        return json(route, {
          channel,
          status: 'not_paired',
          code: null,
          instruction: null,
          codeExpiresAt: null,
          pairedAt: null,
        })
      }
    }

    // --- Detection history ---
    if (path === '/api/detection-events/history' && method === 'GET') {
      const limit = Number(url.searchParams.get('limit') ?? '20')
      const label = url.searchParams.get('label')
      const camera = url.searchParams.get('camera')
      const profileId = url.searchParams.get('profileId')
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      // The cursor is the last returned detection's date, in milliseconds (ADR-49).
      const cursor = url.searchParams.get('cursor')

      const matching = state.detectionHistory
        .filter((event) => !label || event.label === label)
        .filter((event) => !camera || event.camera.includes(camera))
        .filter((event) => !profileId || event.profileId === profileId)
        .filter((event) => !from || Date.parse(event.occurredAt) >= Date.parse(from))
        .filter((event) => !to || Date.parse(event.occurredAt) <= Date.parse(to))
        .filter((event) => !cursor || Date.parse(event.occurredAt) < Number(cursor))
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))

      const items = matching.slice(0, limit)
      return json(route, {
        items,
        // A full page may hide more; a short one means the oldest detection was reached.
        nextCursor:
          items.length === limit ? String(Date.parse(items[items.length - 1].occurredAt)) : null,
      })
    }
    if (path.match(/^\/api\/detection-events\/[^/]+\/identity$/) && method === 'PATCH') {
      return json(route, {})
    }

    return json(route, { message: `unmocked: ${method} ${path}` }, 404)
  })
}
