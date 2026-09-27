import type { Page, Route } from '@playwright/test'

export interface FakeCamera {
  id: string
  slug: string
  displayName: string
  sourceType: string
  host: string
  username: string | null
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
  privacyMiss: string | null
  privacyMissDetail: string | null
  ptzSupported: boolean
  privacyStrategy: string
  verifiedCapabilities: string[]
}

/** A protocol the fake camera speaks, as the Connexion page reads it (ADR-61). */
export interface FakeProtocol {
  protocol: string
  port: number | null
  effectivePort: number | null
  username: string | null
  hasSpecificAccount: boolean
  deviceId: number | null
  status: 'answers' | 'refused' | 'unreachable' | null
  checkedAt: string | null
  lastError: string | null
}

export function makeFakeProtocol(overrides: Partial<FakeProtocol> = {}): FakeProtocol {
  return {
    protocol: 'rtsp',
    port: null,
    effectivePort: 554,
    username: null,
    hasSpecificAccount: false,
    deviceId: null,
    status: 'answers',
    checkedAt: '2026-01-01T00:00:00Z',
    lastError: null,
    ...overrides,
  }
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

// What the API answers for a person's links: one enabled link per camera they are restricted to.
function fakeCameraLinks(state: FakeBackendState, profileId: string) {
  return (state.profileCameraLinks[profileId] ?? []).map((cameraId) => ({
    id: `link-${cameraId}`,
    profileId,
    profileName: '',
    cameraId,
    cameraDisplayName: null,
    enabled: true,
  }))
}

export function makeFakeCamera(overrides: Partial<FakeCamera> = {}): FakeCamera {
  return {
    id: 'camera-1',
    slug: 'front-door',
    displayName: 'Porte d’entrée',
    sourceType: 'rtsp_manual',
    host: '192.168.1.50',
    username: null,
    status: 'online',
    validationState: 'validated',
    isEnabled: true,
    previewAvailable: true,
    needsAttention: false,
    lastReachabilityCheckAt: new Date().toISOString(),
    lastSuccessfulFrameAt: new Date().toISOString(),
    // Derived from the slug as the backend does, so each camera has its own frame-rate row.
    frigateCameraName: (overrides.slug ?? 'front-door').replaceAll('-', '_'),
    vendorFamily: null,
    privacyModeActive: false,
    privacyModeSource: null,
    privacyVendorCut: false,
    privacyMiss: null,
    privacyMissDetail: null,
    ptzSupported: false,
    privacyStrategy: 'software_blur',
    verifiedCapabilities: [],
    ...overrides,
  }
}

/** Mirrors the backend channel catalogue: a channel declares what it needs and what it can render. */
interface FakeChannelListening {
  listening: boolean
  since: string | null
  interruptedAt: string | null
  reason: string | null
}

interface FakeChannelPairing {
  status: 'not_paired' | 'awaiting_conversation' | 'paired' | 'expired'
  pairedAt: string | null
}

interface FakeCommandJournalEntry {
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

/** A channel already in place, to start from a configured screen without replaying the journey. */
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

interface FakeAccessState {
  installed: boolean
  signedIn: boolean
  /** The password was just removed from the host machine (ADR-54). */
  awaitingReset?: boolean
  /** What the fake installation accepts today: changing it must change what opens. */
  password?: string
}

export interface FakeBackendState {
  cameras: FakeCamera[]
  /** Where the installation stands on its password, and where this browser stands with it. */
  access: FakeAccessState
  /** Saved settings that surveillance has not picked up yet (ADR-44). */
  pendingChanges: boolean
  restartFails: boolean
  /** Frames a second received per camera id, where a test needs a low rate; others get 10, an offline one 0. */
  receivedFps: Record<string, number>
  /** The API itself breaks on the restart, instead of reporting a restart that did not take. */
  restartBreaks: boolean
  privacySchedules: {
    id: string
    cameraId: string
    enabled: boolean
    daysOfWeek: number[]
    startTime: string
    endTime: string
    createdAt: string
  }[]
  profiles: {
    id: string
    name: string
    category: string
    alertMode: string
    lastSeenAt: string | null
    createdAt: string
  }[]
  notificationChannels: Record<string, FakeChannelConfig>
  /** The state of a channel's incoming loop, and the trace of what was asked of it (ADR-52). */
  channelListening: Record<string, FakeChannelListening>
  /** A linked conversation, where a test needs one; none means nothing is linked. */
  channelPairing: Record<string, FakeChannelPairing>
  commandJournal: Record<string, FakeCommandJournalEntry[]>
  /** The cameras each person is restricted to, by profile id; none means every camera. */
  profileCameraLinks: Record<string, string[]>
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
  /** The camera's stream capability: the protocol that carries it and its main path (ADR-61). */
  streamBinding: {
    protocol: string
    streamPath: string | null
    lastError: string | null
    /** False for a camera whose stream is still to choose; true when left out. */
    configured?: boolean
  }
  /** The protocols the camera speaks, one box each in Avancé (ADR-61). */
  protocols: FakeProtocol[]
  /** The protocols a search or a detection finds answering, added to the boxes then. */
  discoverableProtocols: FakeProtocol[]
  /** The camera's PTZ binding as the capability list shows it, when it has one. */
  ptzBinding: { protocol: string; configJson: string | null } | null
  /** The control of a camera: its saved positions, and whether it knows where it is (ADR-25). */
  ptz: {
    presets: {
      presetId: number
      label: string
      native: boolean
      panMs: number | null
      tiltMs: number | null
      configured: boolean
    }[]
    calibrated: boolean
    currentPosition: { x: number; y: number } | null
    /** A held press the fake has started and not yet stopped (ADR-60). */
    holding?: boolean
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
    // Installed and unlocked by default: every test would otherwise walk through the same door (ADR-54).
    access: { installed: true, signedIn: true },
    pendingChanges: false,
    restartFails: false,
    receivedFps: {},
    restartBreaks: false,
    privacySchedules: [],
    profiles: [],
    notificationChannels: {},
    channelListening: {},
    channelPairing: {},
    commandJournal: {},
    profileCameraLinks: {},
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
    // Values shipped by Vyzio (ADR-39).
    recordingSettings: {
      continuous: { days: 0, default: 0 },
      motion: { days: 7, default: 7 },
      eventClip: { days: 14, default: 14 },
      maxDays: 365,
    },
    streamBinding: { protocol: 'rtsp', streamPath: '/Streaming/Channels/101', lastError: null },
    protocols: [makeFakeProtocol()],
    discoverableProtocols: [],
    ptzBinding: null,
    ptz: { presets: [], calibrated: true, currentPosition: { x: 0, y: 0 } },
    ...overrides,
  }
}

/** The fake installation's password: the tests type it, nothing else knows it. */
export const FAKE_PASSWORD = 'mot-de-passe-de-test'

function streamBindingOf(binding: FakeBackendState['streamBinding']) {
  const configured = binding.configured !== false
  return {
    capability: 'stream',
    protocol: binding.protocol,
    configJson: null,
    verified: configured && binding.lastError === null,
    verifiedAt: '2026-01-01T00:00:00Z',
    lastError: binding.lastError,
    isPreset: false,
    isConfigured: configured,
    panInverted: null,
    streamPath: binding.streamPath,
  }
}

/** The protocol half of detection: what answers joins the boxes, what the camera had stays. */
function findProtocols(state: FakeBackendState) {
  for (const found of state.discoverableProtocols) {
    if (!state.protocols.some((p) => p.protocol === found.protocol)) state.protocols.push(found)
  }
}

function ptzBindingOf(binding: { protocol: string; configJson: string | null }) {
  return {
    capability: 'ptz',
    protocol: binding.protocol,
    configJson: binding.configJson,
    verified: true,
    verifiedAt: '2026-01-01T00:00:00Z',
    lastError: null,
    isPreset: false,
    isConfigured: true,
    panInverted:
      (JSON.parse(binding.configJson ?? '{}') as { pan_inverted?: boolean }).pan_inverted ?? false,
    streamPath: null,
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

    // --- Access (ADR-54) ---
    if (path === '/api/access/state' && method === 'GET') {
      return json(route, {
        installed: state.access.installed,
        awaitingReset: state.access.awaitingReset ?? false,
        minimumPasswordLength: 8,
      })
    }

    if (path === '/api/access/session' && method === 'GET') {
      return state.access.signedIn
        ? json(route, { role: 'owner', expiresAt: '2027-01-01T00:00:00Z' })
        : json(route, { error: 'unauthorized' }, 401)
    }

    if (path === '/api/access/account' && method === 'POST') {
      const chosen = (postData?.password as string | undefined) ?? ''
      state.access = { installed: true, signedIn: true, password: chosen }
      return json(route, { role: 'owner', expiresAt: '2027-01-01T00:00:00Z' })
    }

    if (path === '/api/access/session' && method === 'POST') {
      const password = (postData?.password as string | undefined) ?? ''
      if (password !== (state.access.password ?? FAKE_PASSWORD))
        return json(route, { error: 'unauthorized' }, 401)

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

    // Past this line everything needs a session, like the API does: otherwise the harness would be
    // testing an application nobody runs (ADR-54).
    if (!state.access.signedIn) return json(route, { error: 'unauthorized' }, 401)

    // Guarded like the rest: changing a password is a setting, not a way in.
    if (path === '/api/access/password' && method === 'PUT') {
      const current = (postData?.currentPassword as string | undefined) ?? ''
      const next = (postData?.newPassword as string | undefined) ?? ''
      if (current !== (state.access.password ?? FAKE_PASSWORD))
        return json(route, { error: 'wrong_password' }, 400)
      if (next.length < 8) return json(route, { error: 'password_too_short' }, 400)

      state.access = { ...state.access, password: next }
      return json(route, { role: 'owner', expiresAt: '2027-01-01T00:00:00Z' })
    }

    // --- Hub ---
    if (path === '/api/hub/overview' && method === 'GET') {
      return json(route, {
        systemHealthy: true,
        recentEvents: state.detectionHistory.slice(0, 5),
        profiles: state.profiles,
        // Counted from the channels set up, so the hub and the Notifications screen tell the same story.
        notifications: {
          activeChannels: Object.values(state.notificationChannels).filter(
            (c) => c.isEnabled && c.isConfigured,
          ).length,
          sentCount: 0,
          lastSentAt: null,
        },
        warnings: [],
      })
    }

    // --- System ---
    if (path === '/api/system/stats' && method === 'GET') {
      return json(route, {
        status: 'active',
        storage: { totalGb: 500, usedGb: 120, freeGb: 380 },
        cameras: state.cameras.map((c) => ({
          camera: c.frigateCameraName ?? c.slug,
          fps: c.status === 'offline' ? 0 : (state.receivedFps[c.id] ?? 10),
        })),
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
        validationState: 'validated',
        status: 'online',
      })
      // Like the real one: the camera is born with its stream capability (ADR-61).
      const stream = postData?.stream as { protocol: string; path: string | null } | undefined
      if (stream)
        state.streamBinding = {
          protocol: stream.protocol,
          streamPath: stream.path,
          lastError: null,
        }
      state.cameras.push(camera)
      // Like the real one: the catalogue changed, surveillance has not picked it up.
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
      if (state.restartBreaks) {
        const problem = {
          title: 'An error occurred while processing your request.',
          status: 500,
          traceId: '00-e2e-01',
        }
        return json(route, problem, 500)
      }
      // Like the real one: a successful restart clears the pending state, a failure leaves it.
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
      if (rest === '/ptz/move/start' && method === 'POST') {
        state.ptz.currentPosition = null
        state.ptz.holding = true
        return json(route, {})
      }
      if (rest === '/ptz/move/signal' && method === 'POST') {
        return state.ptz.holding ? json(route, {}) : json(route, {}, 404)
      }
      if (rest === '/ptz/move/stop' && method === 'POST') {
        state.ptz.holding = false
        return json(route, {})
      }
      if (rest === '/ptz/calibrate' && method === 'POST') {
        state.ptz.calibrated = true
        state.ptz.currentPosition = { x: 0, y: 0 }
        return json(route, {})
      }
      if (rest === '/ptz/preset/goto' && method === 'POST') {
        const target = state.ptz.presets.find((p) => p.presetId === postData?.presetId)
        state.ptz.currentPosition = target ? { x: target.panMs ?? 0, y: target.tiltMs ?? 0 } : null
        return json(route, {})
      }
      if (rest === '/ptz/preset/save' && method === 'POST') {
        // Like the real one: with no reference, the current position is unknown, nothing is saved.
        if (!state.ptz.calibrated) return json(route, { message: 'not_calibrated' }, 409)
        const presetId = Number(postData?.presetId)
        const position = state.ptz.currentPosition ?? { x: 0, y: 0 }
        state.ptz.presets = [
          ...state.ptz.presets.filter((p) => p.presetId !== presetId),
          {
            presetId,
            label: `Position ${presetId}`,
            native: false,
            panMs: position.x,
            tiltMs: position.y,
            configured: true,
          },
        ]
        return json(route, {})
      }
      if (rest?.startsWith('/ptz/presets/') && rest.endsWith('/snapshot')) {
        return json(route, {})
      }

      if (rest === '/capabilities' && method === 'GET') {
        const stream = streamBindingOf(state.streamBinding)
        return json(route, state.ptzBinding ? [stream, ptzBindingOf(state.ptzBinding)] : [stream])
      }
      if (rest === '/capabilities/stream/path' && method === 'PUT') {
        state.streamBinding.streamPath = (postData?.path as string | null) ?? null
        state.pendingChanges = true
        return json(route, streamBindingOf(state.streamBinding))
      }
      if (rest === '/capabilities/stream' && method === 'PUT') {
        // Like the real one: a capability goes through one of the camera's protocols (ADR-61 d).
        const chosen = postData?.protocol as string
        if (!state.protocols.some((p) => p.protocol === chosen)) {
          return json(route, { error: 'protocol_not_on_camera' }, 409)
        }
        state.streamBinding.protocol = chosen
        state.streamBinding.configured = true
        return json(route, streamBindingOf(state.streamBinding))
      }
      if (rest === '/capabilities/detect' && method === 'POST') {
        // Both levels in order: the protocols that answer, then the stream when it is still to choose.
        findProtocols(state)
        const stream = ['rtsp', 'dvrip'].find((name) =>
          state.protocols.some((p) => p.protocol === name && p.status === 'answers'),
        )
        if (state.streamBinding.configured === false && stream) {
          state.streamBinding.protocol = stream
          state.streamBinding.configured = true
        }
        return route.fulfill({ status: 204 })
      }
      if (rest === '/protocols/search' && method === 'POST') {
        findProtocols(state)
        return json(route, state.protocols)
      }
      if (rest === '/capabilities/stream/probe' && method === 'POST') {
        return json(route, streamBindingOf(state.streamBinding))
      }
      if (rest === '/protocols' && method === 'GET') {
        return json(route, state.protocols)
      }
      if (rest === '/protocols' && method === 'POST') {
        // Like the real one: a protocol is added once, then checked at once.
        const name = postData?.protocol as string
        if (state.protocols.some((p) => p.protocol === name)) {
          return json(route, { error: 'protocol_exists' }, 409)
        }
        const username = (postData?.username as string | null) ?? null
        const added = makeFakeProtocol({
          protocol: name,
          port: (postData?.port as number | null) ?? null,
          effectivePort: (postData?.port as number | null) ?? null,
          username,
          hasSpecificAccount: username !== null,
        })
        state.protocols.push(added)
        return json(route, added)
      }
      const protocolMatch = rest?.match(/^\/protocols\/([^/]+)(\/check)?$/)
      if (protocolMatch) {
        const [, name, check] = protocolMatch
        const entry = state.protocols.find((p) => p.protocol === name)
        if (!entry) return json(route, { message: 'not found' }, 404)
        if (!check && method === 'DELETE') {
          // Like the real one: a protocol a capability goes through stays.
          const used = [state.streamBinding.protocol, state.ptzBinding?.protocol].includes(name)
          if (used) return json(route, { error: 'protocol_in_use' }, 409)
          state.protocols = state.protocols.filter((p) => p.protocol !== name)
          return route.fulfill({ status: 204 })
        }
        if (check && method === 'POST') {
          entry.checkedAt = new Date().toISOString()
          return json(route, entry)
        }
        if (method === 'PUT') {
          const username = (postData?.username as string | null) ?? null
          entry.port = (postData?.port as number | null) ?? null
          entry.effectivePort = entry.port ?? entry.effectivePort
          entry.username = username
          entry.hasSpecificAccount = username !== null
          entry.deviceId = (postData?.deviceId as number | null) ?? null
          entry.status = null
          state.pendingChanges = true
          return json(route, entry)
        }
      }
      if (rest === '/capabilities/ptz/probe' && method === 'POST') {
        return state.ptzBinding ? json(route, ptzBindingOf(state.ptzBinding)) : json(route, {}, 404)
      }
      if (rest === '/capabilities/ptz/pan-inverted' && method === 'PUT') {
        if (!state.ptzBinding) return json(route, {}, 404)
        const inverted = Boolean(postData?.inverted)
        const config = JSON.parse(state.ptzBinding.configJson ?? '{}') as Record<string, unknown>
        state.ptzBinding.configJson = JSON.stringify({ ...config, pan_inverted: inverted })
        return json(route, ptzBindingOf(state.ptzBinding))
      }
      if (rest === '/privacy/schedules' && method === 'GET') {
        return json(
          route,
          state.privacySchedules.filter((s) => s.cameraId === cameraId),
        )
      }
      if (rest === '/privacy/schedules' && method === 'POST') {
        const body = route.request().postDataJSON() as {
          daysOfWeek: number[]
          startTime: string
          endTime: string
        }
        // Like the real one: a range that crosses midnight is kept, an empty one is refused.
        if (body.startTime === body.endTime) {
          return json(
            route,
            { error: 'schedule_empty_range', message: 'Start and end are the same time.' },
            400,
          )
        }
        const schedule = {
          id: `schedule-${state.privacySchedules.length + 1}`,
          cameraId: cameraId!,
          enabled: true,
          ...body,
          createdAt: new Date().toISOString(),
        }
        state.privacySchedules.push(schedule)
        return json(route, schedule, 201)
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
      if (rest === '/camera-links' && method === 'PUT') {
        state.profileCameraLinks[profileId] = (postData?.cameraIds as string[]) ?? []
        return json(route, fakeCameraLinks(state, profileId))
      }
      if (rest === '/camera-links' && method === 'GET')
        return json(route, fakeCameraLinks(state, profileId))
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
        // A channel never configured still has a shape: that is the add screen.
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
        if (method === 'DELETE') {
          delete state.channelPairing[channel]
          return json(route, true)
        }
        return json(route, {
          channel,
          code: null,
          instruction: null,
          codeExpiresAt: null,
          ...(state.channelPairing[channel] ?? { status: 'not_paired', pairedAt: null }),
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
