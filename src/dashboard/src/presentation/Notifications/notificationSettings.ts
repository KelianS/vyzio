import type {
  ChannelCredential,
  ChannelCredentialField,
  MediaMode,
  NotificationChannelConfig,
  SaveNotificationChannelConfigRequest,
} from '../../domain/entities/NotificationChannelConfig'

/** Screen-facing values and their API translation — one place for every fractional/null quirk. */
export type NotificationValues = {
  enabled: boolean
  minimumConfidence: number
  allowedLabels: string[]
  restrictHours: boolean
  fromHour: number
  toHour: number
  limitRepeats: boolean
  cooldownMinutes: number
  mediaMode: MediaMode
  messageFields: string[]
  /** Empty means keep the stored credential; the API never returns a secret. */
} & Record<ChannelCredentialField, string>

/** How each credential is asked for. A channel declares which ones it needs, never how they look. */
export const CREDENTIAL_COPY: Record<
  ChannelCredentialField,
  { label: string; help: string; placeholder: string }
> = {
  bot_token: {
    label: 'Clé du bot',
    help: 'Donnée par @BotFather à la création du bot. Laissez vide pour conserver celle déjà enregistrée.',
    placeholder: '123456:ABC…',
  },
  chat_id: {
    label: 'Identifiant de conversation',
    help: 'Le numéro de la conversation qui recevra les alertes. @userinfobot vous le donne.',
    placeholder: '123456789',
  },
  webhook_url: {
    label: 'Adresse du salon',
    help: 'Donnée par Discord dans Paramètres du salon › Intégrations › Webhooks. Laissez vide pour conserver celle déjà enregistrée.',
    placeholder: 'https://discord.com/api/webhooks/…',
  },
}

export const NOTIFICATION_DRAFT_LABELS: Record<keyof NotificationValues, string> = {
  enabled: 'Envoi des alertes',
  bot_token: CREDENTIAL_COPY.bot_token.label,
  chat_id: CREDENTIAL_COPY.chat_id.label,
  webhook_url: CREDENTIAL_COPY.webhook_url.label,
  minimumConfidence: 'Certitude minimale',
  allowedLabels: 'Ce qui déclenche une alerte',
  restrictHours: 'Plage horaire',
  fromHour: 'Plage horaire',
  toHour: 'Plage horaire',
  limitRepeats: 'Alertes répétées',
  cooldownMinutes: 'Alertes répétées',
  mediaMode: 'Ce qui est envoyé',
  messageFields: 'Détails du message',
}

const DEFAULT_LABELS = ['person_unknown', 'person_known']
const DEFAULT_FIELDS = ['camera', 'time', 'label', 'confidence', 'snapshot']

const EMPTY_CREDENTIALS: Record<ChannelCredentialField, string> = {
  bot_token: '',
  chat_id: '',
  webhook_url: '',
}

export const DEFAULT_NOTIFICATION_VALUES: NotificationValues = {
  ...EMPTY_CREDENTIALS,
  enabled: false,
  minimumConfidence: 75,
  allowedLabels: DEFAULT_LABELS,
  restrictHours: false,
  fromHour: 8,
  toHour: 22,
  limitRepeats: false,
  cooldownMinutes: 5,
  mediaMode: 'clip_or_photo',
  messageFields: DEFAULT_FIELDS,
}

export function toNotificationValues(config: NotificationChannelConfig): NotificationValues {
  const restrictHours = config.activeFromHour !== null && config.activeToHour !== null

  return {
    ...EMPTY_CREDENTIALS,
    // A credential the API hands back (never a secret) is shown as it is stored.
    ...Object.fromEntries(
      config.credentials.map((credential) => [credential.field, credential.value ?? '']),
    ),
    enabled: config.isEnabled,
    minimumConfidence: Math.round(config.minimumConfidence * 100),
    allowedLabels: config.allowedLabels.length > 0 ? config.allowedLabels : DEFAULT_LABELS,
    restrictHours,
    // Hours keep their value when the range toggle is off, so re-enabling restores them.
    fromHour: config.activeFromHour ?? DEFAULT_NOTIFICATION_VALUES.fromHour,
    toHour: config.activeToHour ?? DEFAULT_NOTIFICATION_VALUES.toHour,
    limitRepeats: config.cooldownMinutes !== null,
    cooldownMinutes: config.cooldownMinutes ?? DEFAULT_NOTIFICATION_VALUES.cooldownMinutes,
    mediaMode: config.mediaMode ?? 'clip_or_photo',
    messageFields: config.messageFields?.length > 0 ? config.messageFields : DEFAULT_FIELDS,
  }
}

export function toSaveRequest(
  values: NotificationValues,
  credentials: readonly ChannelCredential[],
): SaveNotificationChannelConfigRequest {
  return {
    isEnabled: values.enabled,
    // Only the fields this channel declared, and only those actually filled in.
    credentials: Object.fromEntries(
      credentials
        .map((credential) => [credential.field, values[credential.field].trim()] as const)
        .filter(([, value]) => value.length > 0),
    ),
    minimumConfidence: values.minimumConfidence / 100,
    allowedLabels: values.allowedLabels,
    activeFromHour: values.restrictHours ? values.fromHour : null,
    activeToHour: values.restrictHours ? values.toHour : null,
    messageFields: values.messageFields,
    mediaMode: values.mediaMode,
    cooldownMinutes: values.limitRepeats ? values.cooldownMinutes : undefined,
    clearCooldown: !values.limitRepeats,
  }
}
