import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  NotificationChannelConfig,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../../domain/entities/NotificationChannelConfig'
import type { GetNotificationChannelConfig } from '../../application/use-cases/GetNotificationChannelConfig'
import type { SaveNotificationChannelConfig } from '../../application/use-cases/SaveNotificationChannelConfig'
import type { TestNotificationChannel } from '../../application/use-cases/TestNotificationChannel'

interface UseNotificationSettingsResult {
  config: NotificationChannelConfig | null
  loading: boolean
  saving: boolean
  testing: boolean
  testResult: TestNotificationChannelResult | null
  save: (request: SaveNotificationChannelConfigRequest) => Promise<void>
  test: () => Promise<void>
}

export function useNotificationSettings(
  channel: string,
  getConfig: GetNotificationChannelConfig,
  saveConfig: SaveNotificationChannelConfig,
  testChannel: TestNotificationChannel,
): UseNotificationSettingsResult {
  const [config, setConfig] = useState<NotificationChannelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestNotificationChannelResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)

    getConfig
      .execute(channel)
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoading(false))

    return () => abortRef.current?.abort()
  }, [channel, getConfig])

  const save = useCallback(
    async (request: SaveNotificationChannelConfigRequest) => {
      setSaving(true)
      setTestResult(null)
      try {
        const updated = await saveConfig.execute(channel, request)
        setConfig(updated)
      } finally {
        setSaving(false)
      }
    },
    [channel, saveConfig],
  )

  const test = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testChannel.execute(channel)
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }, [channel, testChannel])

  return { config, loading, saving, testing, testResult, save, test }
}
