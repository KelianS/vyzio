import type {
  MediaMode,
  NotificationChannelConfig,
  SaveNotificationChannelConfigRequest,
} from '../../domain/entities/NotificationChannelConfig'

/**
 * Les valeurs telles que l'ecran les manipule, et leur traduction vers l'API.
 *
 * L'ecran ne connait ni pourcentages fractionnaires ni « null qui veut dire
 * desactive » : chaque bascule de l'interface est un booleen a elle, et la
 * conversion vit ici, en un seul endroit.
 */
export interface NotificationValues {
  enabled: boolean
  /** Vide = on garde celle deja enregistree ; l'API ne renvoie jamais la cle. */
  botToken: string
  chatId: string
  minimumConfidence: number
  allowedLabels: string[]
  restrictHours: boolean
  fromHour: number
  toHour: number
  limitRepeats: boolean
  cooldownMinutes: number
  mediaMode: MediaMode
  messageFields: string[]
}

export const NOTIFICATION_DRAFT_LABELS: Record<keyof NotificationValues, string> = {
  enabled: 'Alertes Telegram',
  botToken: 'Clé du bot',
  chatId: 'Identifiant de conversation',
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

export const DEFAULT_NOTIFICATION_VALUES: NotificationValues = {
  enabled: false,
  botToken: '',
  chatId: '',
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
    enabled: config.isEnabled,
    botToken: '',
    chatId: config.chatId ?? '',
    minimumConfidence: Math.round(config.minimumConfidence * 100),
    allowedLabels: config.allowedLabels.length > 0 ? config.allowedLabels : DEFAULT_LABELS,
    restrictHours,
    // Les heures gardent leur valeur quand la plage est levee : la reactiver
    // retrouve celle qu'on avait choisie, au lieu de repartir d'un defaut.
    fromHour: config.activeFromHour ?? DEFAULT_NOTIFICATION_VALUES.fromHour,
    toHour: config.activeToHour ?? DEFAULT_NOTIFICATION_VALUES.toHour,
    limitRepeats: config.cooldownMinutes !== null,
    cooldownMinutes: config.cooldownMinutes ?? DEFAULT_NOTIFICATION_VALUES.cooldownMinutes,
    mediaMode: config.mediaMode ?? 'clip_or_photo',
    messageFields: config.messageFields?.length > 0 ? config.messageFields : DEFAULT_FIELDS,
  }
}

export function toSaveRequest(values: NotificationValues): SaveNotificationChannelConfigRequest {
  return {
    isEnabled: values.enabled,
    botToken: values.botToken.trim() || undefined,
    chatId: values.chatId.trim() || undefined,
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
