import { useEffect, useState } from 'react'
import type { GetNotificationChannelConfig } from '../../application/use-cases/GetNotificationChannelConfig'
import type { SaveNotificationChannelConfig } from '../../application/use-cases/SaveNotificationChannelConfig'
import type { TestNotificationChannel } from '../../application/use-cases/TestNotificationChannel'
import type {
  NotificationChannelConfig,
  SaveNotificationChannelConfigRequest,
  TestNotificationChannelResult,
} from '../../domain/entities/NotificationChannelConfig'
import { useNotificationSettings } from '../hooks/useNotificationSettings'

interface NotificationSettingsViewProps {
  getNotificationChannelConfig: GetNotificationChannelConfig
  saveNotificationChannelConfig: SaveNotificationChannelConfig
  testNotificationChannel: TestNotificationChannel
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
  onBack,
}: NotificationSettingsViewProps) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>('telegram')

  const { config, loading, saving, testing, testResult, save, test } = useNotificationSettings(
    selectedChannel,
    getNotificationChannelConfig,
    saveNotificationChannelConfig,
    testNotificationChannel,
  )

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
              testResult={testResult}
              onSave={save}
              onTest={test}
            />
          )}
        </div>
      </div>
    </div>
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
  testResult,
  onSave,
  onTest,
}: {
  config: NotificationChannelConfig | null
  loading: boolean
  saving: boolean
  testing: boolean
  testResult: TestNotificationChannelResult | null
  onSave: (req: SaveNotificationChannelConfigRequest) => Promise<void>
  onTest: () => Promise<void>
}) {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)
  const [minimumConfidence, setMinimumConfidence] = useState(75)
  const [syncedConfig, setSyncedConfig] = useState<NotificationChannelConfig | null>(null)

  useEffect(() => {
    if (config && config !== syncedConfig) {
      setChatId(config.chatId ?? '')
      setIsEnabled(config.isEnabled)
      setMinimumConfidence(Math.round(config.minimumConfidence * 100))
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
