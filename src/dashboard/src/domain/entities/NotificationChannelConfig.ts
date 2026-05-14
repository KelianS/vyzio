export interface NotificationChannelConfig {
  channel: string
  isEnabled: boolean
  hasToken: boolean
  chatId: string | null
  minimumConfidence: number
  allowedLabels: string[]
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
}

export interface TestNotificationChannelResult {
  success: boolean
  errorMessage: string | null
}
