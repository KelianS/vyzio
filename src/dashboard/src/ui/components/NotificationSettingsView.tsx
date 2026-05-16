import { useEffect, useState } from 'react'
import type { DeleteNotificationChannel } from '../../application/use-cases/DeleteNotificationChannel'
import type { GetDetectionLabels } from '../../application/use-cases/GetDetectionLabels'
import type { GetNotificationChannelConfig } from '../../application/use-cases/GetNotificationChannelConfig'
import type { GetNotificationLog } from '../../application/use-cases/GetNotificationLog'
import type { SaveNotificationChannelConfig } from '../../application/use-cases/SaveNotificationChannelConfig'
import type { TestNotificationChannel } from '../../application/use-cases/TestNotificationChannel'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type {
  MediaMode,
  NotificationChannelConfig,
  NotificationLogEntry,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../../domain/entities/NotificationChannelConfig'
import { useNotificationSettings } from '../hooks/useNotificationSettings'

interface NotificationSettingsViewProps {
  getNotificationChannelConfig: GetNotificationChannelConfig
  saveNotificationChannelConfig: SaveNotificationChannelConfig
  testNotificationChannel: TestNotificationChannel
  deleteNotificationChannel: DeleteNotificationChannel
  getNotificationLog: GetNotificationLog
  getNotificationLabels: GetDetectionLabels
  onBack: () => void
}

type ChannelId = 'telegram'

interface Channel {
  id: ChannelId
  label: string
  description: string
}

const CHANNELS: Channel[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    description: 'Alertes instantanees sur telephone ou ordinateur via bot Telegram.',
  },
]

export function NotificationSettingsView({
  getNotificationChannelConfig,
  saveNotificationChannelConfig,
  testNotificationChannel,
  deleteNotificationChannel,
  getNotificationLog,
  getNotificationLabels,
  onBack,
}: NotificationSettingsViewProps) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>('telegram')
  const [notifLog, setNotifLog] = useState<NotificationLogEntry[]>([])
  const [logRefreshKey, setLogRefreshKey] = useState(0)
  const [detectionLabels, setDetectionLabels] = useState<DetectionLabel[]>([])

  useEffect(() => {
    getNotificationLabels.execute().then(setDetectionLabels).catch(() => setDetectionLabels([]))
  }, [getNotificationLabels])

  useEffect(() => {
    getNotificationLog.execute(selectedChannel).then(setNotifLog).catch(() => setNotifLog([]))
  }, [selectedChannel, getNotificationLog, logRefreshKey])

  const refreshLog = () => setLogRefreshKey((k) => k + 1)

  const { config, loading, saving, testing, removing, testResult, save, test, remove } =
    useNotificationSettings(
      selectedChannel,
      getNotificationChannelConfig,
      saveNotificationChannelConfig,
      testNotificationChannel,
      deleteNotificationChannel,
    )

  async function handleSaveWithRefresh(req: Parameters<typeof save>[0]) {
    await save(req)
    refreshLog()
  }

  async function handleTestWithRefresh() {
    await test()
    refreshLog()
  }

  return (
    <div className="app-shell app-shell-cameras">
      <div className="camera-toolbar panel">
        <div className="camera-toolbar-copy">
          <p className="eyebrow">Notifications</p>
          <h1>Configuration des alertes</h1>
          <p className="camera-toolbar-lede">
            Configurez comment Vyzio vous alertera lors d'une detection.
          </p>
        </div>
        <div className="camera-toolbar-status">
          <ChannelStatusSummary config={config} loading={loading} />
        </div>
      </div>

      <div className="camera-master-detail">
        <aside className="camera-sidebar panel">
          <div className="camera-sidebar-group">
            <div className="camera-sidebar-header">
              <h2>Canaux</h2>
            </div>
            {CHANNELS.map((channel) => (
              <button
                key={channel.id}
                type="button"
                className={`camera-nav-item${selectedChannel === channel.id ? ' selected' : ''}`}
                onClick={() => setSelectedChannel(channel.id)}
              >
                <div className="candidate-preview-main">
                  <strong>{channel.label}</strong>
                  <p>{channel.description}</p>
                </div>
                <div className="camera-nav-meta">
                  <ChannelStatusBadge
                    config={config}
                    loading={loading}
                    channel={channel.id}
                    selectedChannel={selectedChannel}
                  />
                </div>
              </button>
            ))}
          </div>

          <div className="camera-sidebar-actions">
            <button type="button" className="secondary-cta" onClick={onBack}>
              ← Retour au hub
            </button>
          </div>
        </aside>

        <div className="camera-detail-panel panel">
          {selectedChannel === 'telegram' && (
            <TelegramConfigPanel
              config={config}
              loading={loading}
              saving={saving}
              testing={testing}
              removing={removing}
              testResult={testResult}
              notifLog={notifLog}
              detectionLabels={detectionLabels}
              onSave={handleSaveWithRefresh}
              onTest={handleTestWithRefresh}
              onRemove={remove}
              onRefreshLog={refreshLog}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function LabelCheckboxes({
  labels,
  selected,
  onChange,
}: {
  labels: DetectionLabel[]
  selected: string[]
  onChange: (labels: string[]) => void
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      const next = selected.filter((l) => l !== value)
      onChange(next.length > 0 ? next : [value])
    } else {
      onChange([...selected, value])
    }
  }

  if (labels.length === 0) return null

  const personGroup = labels.filter((l) => l.value === 'person_unknown' || l.value === 'person_known')
  const otherLabels = labels.filter((l) => l.value !== 'person_unknown' && l.value !== 'person_known')

  return (
    <div className="camera-form-field">
      <label>Categories de detection notifiees</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {personGroup.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {personGroup.map(({ value, displayName, emoji }) => (
              <label
                key={value}
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(value)}
                  onChange={() => toggle(value)}
                />
                {emoji} {displayName}
              </label>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {otherLabels.map(({ value, displayName, emoji }) => (
            <label
              key={value}
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => toggle(value)}
              />
              {emoji} {displayName}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

const MESSAGE_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'camera', label: 'Caméra' },
  { value: 'time', label: 'Heure' },
  { value: 'label', label: "Type d'événement" },
  { value: 'confidence', label: 'Confiance' },
  { value: 'snapshot', label: 'Aperçu (photo)' },
]

function MessageFieldsSelector({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (fields: string[]) => void
}) {
  function toggle(field: string) {
    if (selected.includes(field)) {
      const next = selected.filter((f) => f !== field)
      onChange(next.length > 0 ? next : [field]) // keep at least one
    } else {
      onChange([...selected, field])
    }
  }

  return (
    <div className="camera-form-field">
      <label>Champs inclus dans le message</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 6 }}>
        {MESSAGE_FIELD_OPTIONS.map(({ value, label }) => (
          <label
            key={value}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => toggle(value)}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}

const MEDIA_MODE_OPTIONS: { value: MediaMode; label: string; description: string }[] = [
  { value: 'clip_or_photo', label: 'Album (photo + clip)', description: 'Envoie la photo avec zone de detection et le clip ensemble dans un album.' },
  { value: 'photo', label: 'Photo uniquement', description: 'Envoie toujours une photo, jamais de clip.' },
  { value: 'text', label: 'Texte uniquement', description: 'Aucun media, juste le message texte.' },
]

function MediaModeSelector({
  value,
  onChange,
}: {
  value: MediaMode
  onChange: (mode: MediaMode) => void
}) {
  return (
    <div className="camera-form-field">
      <label>Format des notifications</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {MEDIA_MODE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <input
              type="radio"
              name="media-mode"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>
              <strong>{opt.label}</strong>
              <span style={{ marginLeft: 6, fontSize: '0.85rem', opacity: 0.7 }}>{opt.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function CooldownPicker({
  cooldownMinutes,
  onChange,
}: {
  cooldownMinutes: number | null
  onChange: (minutes: number | null) => void
}) {
  const enabled = cooldownMinutes !== null

  function handleToggle(on: boolean) {
    onChange(on ? 5 : null)
  }

  return (
    <div className="camera-form-field">
      <label>Anti-spam (cooldown)</label>
      <div className="camera-form-field-inline" style={{ marginTop: 6 }}>
        <input
          id="cooldown-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <label htmlFor="cooldown-enabled" style={{ marginLeft: 4 }}>
          Limiter a une notification par detection unique
        </label>
      </div>
      {enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <label htmlFor="cooldown-minutes" style={{ fontSize: '0.88rem' }}>
            Silence pendant
          </label>
          <input
            id="cooldown-minutes"
            type="number"
            min={1}
            max={60}
            step={1}
            value={cooldownMinutes ?? 5}
            onChange={(e) => onChange(Math.max(1, Number(e.target.value)))}
            style={{ width: 64 }}
          />
          <span style={{ fontSize: '0.88rem' }}>minutes apres chaque envoi (par camera et type)</span>
        </div>
      )}
      {!enabled && (
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-soft)', marginTop: 4 }}>
          Chaque detection Frigate peut declencher une notification independante.
        </p>
      )}
    </div>
  )
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${String(h).padStart(2, '0')}:00`,
}))

function SchedulePicker({
  fromHour,
  toHour,
  onFromChange,
  onToChange,
}: {
  fromHour: number | null
  toHour: number | null
  onFromChange: (h: number | null) => void
  onToChange: (h: number | null) => void
}) {
  const scheduleEnabled = fromHour !== null && toHour !== null

  function handleToggle(enabled: boolean) {
    if (enabled) {
      onFromChange(8)
      onToChange(22)
    } else {
      onFromChange(null)
      onToChange(null)
    }
  }

  return (
    <div className="camera-form-field">
      <label>Plage horaire active</label>
      <div className="camera-form-field-inline" style={{ marginTop: 6 }}>
        <input
          id="schedule-enabled"
          type="checkbox"
          checked={scheduleEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <label htmlFor="schedule-enabled" style={{ marginLeft: 4 }}>
          Restreindre aux heures suivantes
        </label>
      </div>
      {scheduleEnabled && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
          <div>
            <label htmlFor="from-hour" style={{ fontSize: '0.88rem', display: 'block' }}>
              De
            </label>
            <select
              id="from-hour"
              value={fromHour ?? 8}
              onChange={(e) => onFromChange(Number(e.target.value))}
            >
              {HOUR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="to-hour" style={{ fontSize: '0.88rem', display: 'block' }}>
              A
            </label>
            <select
              id="to-hour"
              value={toHour ?? 22}
              onChange={(e) => onToChange(Number(e.target.value))}
            >
              {HOUR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {fromHour !== null && toHour !== null && fromHour > toHour && (
            <p style={{ fontSize: '0.84rem', color: 'var(--ink-soft)', marginTop: 4 }}>
              Plage de nuit : actif de {String(fromHour).padStart(2, '0')}:00 a{' '}
              {String(toHour).padStart(2, '0')}:00 le lendemain.
            </p>
          )}
        </div>
      )}
      {!scheduleEnabled && (
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-soft)', marginTop: 4 }}>
          Notifications actives 24h/24.
        </p>
      )}
    </div>
  )
}

function NotificationLogSection({
  entries,
  onRefresh,
}: {
  entries: NotificationLogEntry[]
  onRefresh: () => void
}) {
  return (
    <section className="camera-detail-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Historique des envois</h3>
        <button type="button" className="secondary-cta" style={{ minHeight: 30, padding: '0 12px', fontSize: '0.82rem' }} onClick={onRefresh}>
          Rafraichir
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="camera-toolbar-lede" style={{ fontSize: '0.9rem' }}>
          Aucun envoi enregistre. Les notifications sont traitees en temps reel — les evenements
          deja visibles sur le hub ont ete detectes avant la configuration du canal.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(247,244,237,0.15)' }}>
              <th style={{ padding: '4px 8px' }}>Date</th>
              <th style={{ padding: '4px 8px' }}>Statut</th>
              <th style={{ padding: '4px 8px' }}>Erreur</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr
                key={i}
                style={{ borderBottom: '1px solid rgba(247,244,237,0.07)', opacity: 0.9 }}
              >
                <td style={{ padding: '4px 8px' }}>
                  {new Date(e.sentAt).toLocaleString('fr-FR')}
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <span
                    className={`camera-support-badge ${e.status === 'sent' ? 'supported' : 'unsupported'}`}
                  >
                    {e.status === 'sent' ? 'Envoyé' : 'Echec'}
                  </span>
                </td>
                <td style={{ padding: '4px 8px', color: 'var(--status-degraded, #e05252)' }}>
                  {e.errorMessage ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ChannelStatusSummary({
  config,
  loading,
}: {
  config: NotificationChannelConfig | null
  loading: boolean
}) {
  if (loading) {
    return <p style={{ color: 'rgba(247,244,237,0.74)' }}>Chargement…</p>
  }
  const active = config?.isEnabled && config?.hasToken && config?.chatId
  const configured = config?.hasToken && config?.chatId
  const label = active
    ? 'Telegram actif'
    : configured
      ? 'Configure — inactif'
      : 'Aucun canal configure'
  const detail = active
    ? 'Les alertes Telegram sont operationnelles.'
    : configured
      ? 'Le canal est configure mais desactive.'
      : 'Configurez un canal pour recevoir des alertes.'

  return (
    <>
      <div className={`status-pill ${active ? 'online' : configured ? 'warning' : 'degraded'}`}>
        {label}
      </div>
      <p style={{ color: 'rgba(247,244,237,0.74)', marginTop: 8 }}>{detail}</p>
      {config?.lastTestedAt && (
        <p style={{ color: 'rgba(247,244,237,0.54)', fontSize: '0.84rem', marginTop: 4 }}>
          Dernier test : {new Date(config.lastTestedAt).toLocaleString('fr-FR')}
          {config.lastTestStatus === 'success' ? ' — reussi' : ' — echec'}
        </p>
      )}
    </>
  )
}

function ChannelStatusBadge({
  config,
  loading,
  channel,
  selectedChannel,
}: {
  config: NotificationChannelConfig | null
  loading: boolean
  channel: ChannelId
  selectedChannel: ChannelId
}) {
  if (channel !== selectedChannel) return null
  if (loading) return <small style={{ color: 'var(--ink-soft)' }}>…</small>
  const active = config?.isEnabled && config?.hasToken && config?.chatId
  const configured = config?.hasToken && config?.chatId
  return (
    <span
      className={`camera-support-badge ${active ? 'supported' : configured ? 'unknown' : 'unknown'}`}
    >
      {active ? 'Actif' : configured ? 'Inactif' : 'Non configure'}
    </span>
  )
}

function TelegramConfigPanel({
  config,
  loading,
  saving,
  testing,
  removing,
  testResult,
  notifLog,
  detectionLabels,
  onSave,
  onTest,
  onRemove,
  onRefreshLog,
}: {
  config: NotificationChannelConfig | null
  loading: boolean
  saving: boolean
  testing: boolean
  removing: boolean
  testResult: TestNotificationChannelResult | null
  notifLog: NotificationLogEntry[]
  detectionLabels: DetectionLabel[]
  onSave: (req: SaveNotificationChannelConfigRequest) => Promise<void>
  onTest: () => Promise<void>
  onRemove: () => Promise<void>
  onRefreshLog: () => void
}) {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)
  const [minimumConfidence, setMinimumConfidence] = useState(75)
  const [allowedLabels, setAllowedLabels] = useState<string[]>(['person_unknown', 'person_known'])
  const [activeFromHour, setActiveFromHour] = useState<number | null>(null)
  const [activeToHour, setActiveToHour] = useState<number | null>(null)
  const [messageFields, setMessageFields] = useState<string[]>(['camera', 'time', 'label', 'confidence', 'snapshot'])
  const [mediaMode, setMediaMode] = useState<MediaMode>('clip_or_photo')
  const [cooldownMinutes, setCooldownMinutes] = useState<number | null>(null)
  const [syncedConfig, setSyncedConfig] = useState<NotificationChannelConfig | null>(null)

  useEffect(() => {
    if (config && config !== syncedConfig) {
      setChatId(config.chatId ?? '')
      setIsEnabled(config.isEnabled)
      setMinimumConfidence(Math.round(config.minimumConfidence * 100))
      setAllowedLabels(config.allowedLabels.length > 0 ? config.allowedLabels : ['person_unknown', 'person_known'])
      setActiveFromHour(config.activeFromHour ?? null)
      setActiveToHour(config.activeToHour ?? null)
      setMessageFields(config.messageFields?.length > 0 ? config.messageFields : ['camera', 'time', 'label', 'confidence', 'snapshot'])
      setMediaMode(config.mediaMode ?? 'clip_or_photo')
      setCooldownMinutes(config.cooldownMinutes ?? null)
      setSyncedConfig(config)
    }
  }, [config, syncedConfig])

  const canTest = Boolean(config?.hasToken && config?.chatId)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      isEnabled,
      botToken: botToken.trim() || undefined,
      chatId: chatId.trim() || undefined,
      minimumConfidence: minimumConfidence / 100,
      allowedLabels,
      activeFromHour,
      activeToHour,
      messageFields,
      mediaMode,
      cooldownMinutes: cooldownMinutes ?? undefined,
      clearCooldown: cooldownMinutes === null,
    })
    setBotToken('')
  }

  if (loading) {
    return (
      <div className="camera-detail-section">
        <p className="camera-toolbar-lede">Chargement de la configuration…</p>
      </div>
    )
  }

  return (
    <>
      <section className="camera-detail-section">
        <h3>Etat du canal</h3>
        <dl className="camera-summary-list">
          <div>
            <dt>Canal</dt>
            <dd>Telegram</dd>
          </div>
          <div>
            <dt>Token configure</dt>
            <dd>
              <span
                className={`camera-support-badge ${config?.hasToken ? 'supported' : 'unknown'}`}
              >
                {config?.hasToken ? 'Oui' : 'Non'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Chat ID configure</dt>
            <dd>
              <span className={`camera-support-badge ${config?.chatId ? 'supported' : 'unknown'}`}>
                {config?.chatId ? config.chatId : 'Non configure'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>
              <span
                className={`camera-support-badge ${config?.isEnabled ? 'supported' : 'unknown'}`}
              >
                {config?.isEnabled ? 'Actif' : 'Inactif'}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="camera-detail-section">
        <h3>Configuration</h3>
        <form onSubmit={handleSave} className="camera-form">
          <div className="camera-form-field">
            <label htmlFor="bot-token">Token du bot</label>
            <input
              id="bot-token"
              type="password"
              placeholder={
                config?.hasToken
                  ? '••••••• (token deja enregistre — laisser vide pour conserver)'
                  : 'Entrez le token fourni par @BotFather'
              }
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="camera-form-field">
            <label htmlFor="chat-id">Chat ID</label>
            <input
              id="chat-id"
              type="text"
              placeholder="Ex : 123456789"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
          </div>

          <div className="camera-form-field">
            <label htmlFor="min-confidence">Confiance minimale : {minimumConfidence} %</label>
            <input
              id="min-confidence"
              type="range"
              min={50}
              max={99}
              step={1}
              value={minimumConfidence}
              onChange={(e) => setMinimumConfidence(Number(e.target.value))}
            />
          </div>

          <LabelCheckboxes labels={detectionLabels} selected={allowedLabels} onChange={setAllowedLabels} />

          <MessageFieldsSelector selected={messageFields} onChange={setMessageFields} />

          <MediaModeSelector value={mediaMode} onChange={setMediaMode} />

          <CooldownPicker cooldownMinutes={cooldownMinutes} onChange={setCooldownMinutes} />

          <SchedulePicker
            fromHour={activeFromHour}
            toHour={activeToHour}
            onFromChange={setActiveFromHour}
            onToChange={setActiveToHour}
          />

          <div className="camera-form-field camera-form-field-inline">
            <input
              id="is-enabled"
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            <label htmlFor="is-enabled">Activer les notifications Telegram</label>
          </div>

          <div className="camera-form-actions">
            <button type="submit" className="primary-cta" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              className="secondary-cta"
              onClick={onTest}
              disabled={testing || !canTest}
              title={canTest ? undefined : 'Configurez le token et le Chat ID avant de tester'}
            >
              {testing ? 'Test en cours…' : 'Tester le canal'}
            </button>
            {config?.hasToken && (
              <button
                type="button"
                className="secondary-cta"
                onClick={onRemove}
                disabled={removing}
                style={{ color: 'var(--status-degraded, #e05252)', marginLeft: 'auto' }}
              >
                {removing ? 'Suppression…' : 'Supprimer le canal'}
              </button>
            )}
          </div>

          {testResult && (
            <p className={`status-inline ${testResult.success ? '' : 'error'}`}>
              {testResult.success
                ? 'Message test envoye avec succes.'
                : `Echec du test : ${testResult.errorMessage ?? 'Erreur inconnue'}`}
            </p>
          )}
        </form>
      </section>

      <NotificationLogSection entries={notifLog} onRefresh={onRefreshLog} />

      <section className="camera-detail-section">
        <h3>Comment obtenir le token et le Chat ID</h3>
        <div className="camera-confidence-details camera-debug-details">
          <ol className="camera-reason-list" style={{ paddingLeft: 20 }}>
            <li>
              <strong>Creez un bot via @BotFather</strong>
              <br />
              Sur Telegram, ecrivez a{' '}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                @BotFather
              </a>
              . Tapez <code>/newbot</code>, choisissez un nom. Copiez le token affiche (format{' '}
              <code>123456:ABC...</code>) et collez-le dans le champ Token ci-dessus.
            </li>
            <li>
              <strong>Demarrez votre bot</strong>
              <br />
              Cherchez votre bot dans Telegram et envoyez-lui <code>/start</code> pour l'activer.
            </li>
            <li>
              <strong>Obtenez votre Chat ID</strong>
              <br />
              Ecrivez a{' '}
              <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer">
                @userinfobot
              </a>{' '}
              sur Telegram. Il repond immediatement avec votre identifiant numerique (ex :{' '}
              <code>123456789</code>). Copiez-le dans le champ Chat ID ci-dessus.
            </li>
            <li>
              <strong>Testez la connexion</strong>
              <br />
              Cliquez sur <em>Tester le canal</em> pour verifier que Vyzio peut envoyer un message a
              votre bot.
            </li>
          </ol>
        </div>
      </section>
    </>
  )
}
