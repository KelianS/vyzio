import type {
  ChannelPairing,
  NotificationChannelConfig,
  NotificationChannelSummary,
} from '../domain/entities/notification_channel_config.entity'

/** A channel as the list screens read it, for tests; each test overrides only what it is about. */
export function makeChannelSummary(
  overrides: Partial<NotificationChannelSummary> = {},
): NotificationChannelSummary {
  return {
    channel: 'telegram',
    displayName: 'Telegram',
    isConfigured: true,
    isEnabled: true,
    acceptsCommands: true,
    ...overrides,
  }
}

/** A channel's full settings as its page reads them, for tests. */
export function makeChannelConfig(
  overrides: Partial<NotificationChannelConfig> = {},
): NotificationChannelConfig {
  return {
    channel: 'telegram',
    displayName: 'Telegram',
    isEnabled: true,
    isConfigured: true,
    credentials: [
      { field: 'bot_token', secret: true, isSet: true, value: null },
      { field: 'chat_id', secret: false, isSet: true, value: '42' },
    ],
    capabilities: {
      photo: true,
      video: true,
      groupedMedia: true,
      buttons: true,
      usefulTextLength: 4096,
    },
    acceptsCommands: false,
    minimumConfidence: 0.75,
    allowedLabels: ['person'],
    activeFromHour: null,
    activeToHour: null,
    messageFields: ['camera', 'time'],
    mediaMode: 'photo',
    cooldownMinutes: null,
    configuredAt: null,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
    ...overrides,
  }
}

/** Which conversation may command the channel, for tests. */
export function makePairing(overrides: Partial<ChannelPairing> = {}): ChannelPairing {
  return {
    channel: 'telegram',
    status: 'not_paired',
    code: null,
    instruction: null,
    codeExpiresAt: null,
    pairedAt: null,
    ...overrides,
  }
}
