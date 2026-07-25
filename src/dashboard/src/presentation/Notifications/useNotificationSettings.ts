import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  NotificationChannelConfig,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../../domain/entities/NotificationChannelConfig'
import type { DeleteNotificationChannel } from '../../domain/usecases/DeleteNotificationChannel'
import type { GetNotificationChannelConfig } from '../../domain/usecases/GetNotificationChannelConfig'
import type { SaveNotificationChannelConfig } from '../../domain/usecases/SaveNotificationChannelConfig'
import type { TestNotificationChannel } from '../../domain/usecases/TestNotificationChannel'

interface UseNotificationSettingsResult {
  config: NotificationChannelConfig | null
  loading: boolean
  saving: boolean
  testing: boolean
  removing: boolean
  testResult: TestNotificationChannelResult | null
  save: (request: SaveNotificationChannelConfigRequest) => Promise<void>
  test: () => Promise<void>
  remove: () => Promise<void>
}

export function useNotificationSettings(
  channel: string,
  getConfig: GetNotificationChannelConfig,
  saveConfig: SaveNotificationChannelConfig,
  testChannel: TestNotificationChannel,
  deleteChannel: DeleteNotificationChannel,
): UseNotificationSettingsResult {
  const [config, setConfig] = useState<NotificationChannelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [testResult, setTestResult] = useState<TestNotificationChannelResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const remove = useCallback(async () => {
    setRemoving(true)
    setTestResult(null)
    try {
      await deleteChannel.execute(channel)
      setConfig(null)
    } finally {
      setRemoving(false)
    }
  }, [channel, deleteChannel])

  return { config, loading, saving, testing, removing, testResult, save, test, remove }
}
