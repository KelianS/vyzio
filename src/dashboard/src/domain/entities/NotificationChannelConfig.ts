export type MediaMode = 'clip_or_photo' | 'photo' | 'text'

/** Channels Vyzio knows how to talk through — the backend catalogue, mirrored (ADR-50). */
export type NotificationChannelName = 'telegram' | 'discord'

const CHANNEL_NAMES: readonly NotificationChannelName[] = ['telegram', 'discord']

/** Parses an address segment: an unknown channel is a wrong URL, not a broken channel. */
export function parseNotificationChannelName(
  value: string | undefined,
): NotificationChannelName | null {
  return CHANNEL_NAMES.find((name) => name === value) ?? null
}

/** A secret or address a channel asks for; which ones apply is declared by the channel. */
export type ChannelCredentialField = 'bot_token' | 'chat_id'

export interface ChannelCredential {
  field: ChannelCredentialField
  /** A secret is never handed back: only the fact that it is stored. */
  secret: boolean
  isSet: boolean
  value: string | null
}

export interface ChannelCapabilities {
  photo: boolean
  video: boolean
  groupedMedia: boolean
  buttons: boolean
  usefulTextLength: number
}

/** A channel as the list screen sees it. */
export interface NotificationChannelSummary {
  channel: NotificationChannelName
  displayName: string
  isConfigured: boolean
  isEnabled: boolean
  /** A channel that cannot receive stays an alert channel; the screen says so before activation (ADR-52). */
  acceptsCommands: boolean
}

export type ChannelPairingStatus = 'not_paired' | 'awaiting_conversation' | 'expired' | 'paired'

/** Which conversation may command Vyzio on a channel — never the conversation itself, only its state. */
export interface ChannelPairing {
  channel: NotificationChannelName
  status: ChannelPairingStatus
  code: string | null
  /** Exactly what to type in the conversation; the screen never composes a command name itself. */
  instruction: string | null
  codeExpiresAt: string | null
  pairedAt: string | null
}

export interface NotificationChannelConfig {
  channel: NotificationChannelName
  displayName: string
  isEnabled: boolean
  isConfigured: boolean
  credentials: ChannelCredential[]
  capabilities: ChannelCapabilities
  acceptsCommands: boolean
  minimumConfidence: number
  allowedLabels: string[]
  activeFromHour: number | null
  activeToHour: number | null
  messageFields: string[]
  mediaMode: MediaMode
  cooldownMinutes: number | null
  configuredAt: string | null
  lastTestedAt: string | null
  lastTestStatus: 'success' | 'failure' | null
  lastTestError: string | null
}

export interface SaveNotificationChannelConfigRequest {
  isEnabled: boolean
  /** A field left out keeps the value already stored. */
  credentials?: Partial<Record<ChannelCredentialField, string>>
  minimumConfidence?: number
  allowedLabels?: string[]
  activeFromHour?: number | null
  activeToHour?: number | null
  messageFields?: string[]
  mediaMode?: MediaMode
  cooldownMinutes?: number | null
  clearCooldown?: boolean
}

export interface TestNotificationChannelResult {
  success: boolean
  errorMessage: string | null
}

export interface NotificationLogEntry {
  status: 'sent' | 'failed'
  sentAt: string
  errorMessage: string | null
}
