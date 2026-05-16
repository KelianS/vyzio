export type MediaMode = 'clip_or_photo' | 'photo' | 'text'

export interface NotificationChannelConfig {
  channel: string
  isEnabled: boolean
  hasToken: boolean
  chatId: string | null
  minimumConfidence: number
  allowedLabels: string[]
  activeFromHour: number | null
  activeToHour: number | null
  messageFields: string[]
  mediaMode: MediaMode
  configuredAt: string | null
  lastTestedAt: string | null
  lastTestStatus: 'success' | 'failure' | null
  lastTestError: string | null
}

export interface SaveNotificationChannelConfigRequest {
  isEnabled: boolean
  botToken?: string
  chatId?: string
  minimumConfidence?: number
  allowedLabels?: string[]
  activeFromHour?: number | null
  activeToHour?: number | null
  messageFields?: string[]
  mediaMode?: MediaMode
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
