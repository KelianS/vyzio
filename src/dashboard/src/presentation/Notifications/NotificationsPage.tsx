import { useState } from 'react'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useUnsavedChanges } from '../Navigation/useUnsavedChanges'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { Button } from '../../common/ui/button'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type {
  MediaMode,
  NotificationChannelConfig,
} from '../../domain/entities/NotificationChannelConfig'
import { NotificationLog } from './NotificationLog'
import { TelegramSetupSteps } from './TelegramSetupSteps'
import {
  DEFAULT_NOTIFICATION_VALUES,
  NOTIFICATION_DRAFT_LABELS,
  toNotificationValues,
  toSaveRequest,
  type NotificationValues,
} from './notificationSettings'

/** Only channel for now — a channel list for one item would be overkill. */
const CHANNEL = 'telegram'

const MEDIA_MODE_OPTIONS: readonly { value: MediaMode; label: string }[] = [
  { value: 'clip_or_photo', label: 'Photo et vidéo' },
  { value: 'photo', label: 'Photo seule' },
  { value: 'text', label: 'Texte seul' },
]

const MESSAGE_FIELD_OPTIONS = [
  { value: 'camera', label: 'Caméra' },
  { value: 'time', label: 'Heure' },
  { value: 'label', label: 'Type d’événement' },
  { value: 'confidence', label: 'Niveau de certitude' },
  { value: 'snapshot', label: 'Aperçu' },
] as const

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}))

export function NotificationsPage() {
  const { notifications: container } = useAppContainer()

  const config = useAsync(() => container.getNotificationChannelConfig.execute(CHANNEL), [])
  const labels = useAsync(() => container.getNotificationLabels.execute(), [])

  if (config.loading || labels.loading) return <SettingsPage>Chargement…</SettingsPage>

  return (
    <NotificationsForm
      config={config.data ?? null}
      labels={labels.data ?? []}
      reload={config.reload}
    />
  )
}

function NotificationsForm({
  config,
  labels,
  reload,
}: {
  config: NotificationChannelConfig | null
  labels: DetectionLabel[]
  reload: () => void
}) {
  const { notifications: container } = useAppContainer()
  const { toast } = useToast()
  const [confirmEnable, setConfirmEnable] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const draft = useSettingsDraft<NotificationValues>({
    saved: config ? toNotificationValues(config) : DEFAULT_NOTIFICATION_VALUES,
    labels: NOTIFICATION_DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(
    async () =>
      container.saveNotificationChannelConfig.execute(CHANNEL, toSaveRequest(draft.values)),
    {
      onSuccess: () => {
        draft.accept()
        toast('Notifications enregistrées.', 'success')
        reload()
      },
    },
  )

  const testing = useAsyncAction(async () => container.testNotificationChannel.execute(CHANNEL), {
    onSuccess: (result) => {
      toast(
        result?.success
          ? 'Message envoyé : le canal fonctionne.'
          : `Échec de l’envoi — ${result?.errorMessage ?? 'raison inconnue'}.`,
        result?.success ? 'success' : 'error',
      )
      reload()
    },
  })

  const removing = useAsyncAction(
    async () => container.deleteNotificationChannel.execute(CHANNEL),
    {
      onSuccess: () => {
        toast('Canal supprimé.', 'info')
        draft.discard()
        reload()
      },
    },
  )

  // Enabling ships images off the local network: asked once, at save, never on the toggle itself.
  function save() {
    if (draft.values.enabled && !config?.isEnabled) {
      setConfirmEnable(true)
      return
    }
    void saving.run()
  }

  const channel: SettingDeclaration[] = [
    {
      id: 'telegram-enabled',
      label: 'Alertes Telegram',
      nature: { kind: 'toggle' },
      consequence:
        'Photos, vidéos et noms de caméras transitent par les serveurs de Telegram : ces images quittent votre réseau.',
      value: draft.values.enabled,
      onChange: (value) => draft.set('enabled', value as boolean),
    },
    {
      id: 'telegram-token',
      label: 'Clé du bot',
      nature: { kind: 'secret', placeholder: config?.hasToken ? 'Inchangée' : '123456:ABC…' },
      help: 'Donnée par @BotFather à la création du bot. Laissez vide pour conserver celle déjà enregistrée.',
      value: draft.values.botToken,
      onChange: (value) => draft.set('botToken', value as string),
    },
    {
      id: 'telegram-chat',
      label: 'Identifiant de conversation',
      nature: { kind: 'text', placeholder: '123456789' },
      help: 'Le numéro de la conversation qui recevra les alertes. @userinfobot vous le donne.',
      value: draft.values.chatId,
      onChange: (value) => draft.set('chatId', value as string),
    },
  ]

  // Meme ordre que la detection : ce qui est concerne d'abord, le seuil ensuite.
  const when: SettingDeclaration[] = [
    {
      id: 'telegram-labels',
      label: 'Ce qui déclenche une alerte',
      nature: {
        kind: 'multiChoice',
        options: labels.map((label) => ({
          value: label.value,
          label: `${label.emoji} ${label.displayName}`,
        })),
      },
      help: 'Seules les catégories cochées vous sont notifiées. Les autres restent détectées et consultables dans l’historique.',
      value: draft.values.allowedLabels,
      onChange: (value) => draft.set('allowedLabels', value as string[]),
    },
    {
      id: 'telegram-confidence',
      label: 'Certitude minimale',
      nature: { kind: 'range', unit: '%', min: 50, max: 99 },
      help: 'En dessous, la détection n’est pas notifiée. Trop bas, vous recevrez des fausses alertes ; trop haut, des détections réelles passeront sous silence.',
      value: draft.values.minimumConfidence,
      onChange: (value) => draft.set('minimumConfidence', value as number),
    },
    {
      id: 'telegram-hours',
      label: 'Seulement à certaines heures',
      nature: { kind: 'toggle' },
      value: draft.values.restrictHours,
      onChange: (value) => draft.set('restrictHours', value as boolean),
    },
  ]

  if (draft.values.restrictHours) {
    when.push(
      {
        id: 'telegram-from',
        label: 'À partir de',
        nature: { kind: 'choice', options: HOUR_OPTIONS },
        value: String(draft.values.fromHour),
        onChange: (value) => draft.set('fromHour', Number(value)),
      },
      {
        id: 'telegram-to',
        label: 'Jusqu’à',
        nature: { kind: 'choice', options: HOUR_OPTIONS },
        // A range ending before it starts crosses midnight — the common case, worth stating.
        consequence:
          draft.values.fromHour > draft.values.toHour
            ? 'La plage passe minuit : les alertes s’arrêtent le lendemain matin.'
            : undefined,
        value: String(draft.values.toHour),
        onChange: (value) => draft.set('toHour', Number(value)),
      },
    )
  }

  when.push({
    id: 'telegram-cooldown-on',
    label: 'Espacer les alertes répétées',
    nature: { kind: 'toggle' },
    help: 'Sans cela, une personne qui reste dans le champ peut déclencher plusieurs alertes de suite.',
    value: draft.values.limitRepeats,
    onChange: (value) => draft.set('limitRepeats', value as boolean),
  })

  if (draft.values.limitRepeats) {
    when.push({
      id: 'telegram-cooldown',
      label: 'Silence après une alerte',
      nature: { kind: 'number', unit: 'minutes', min: 1, max: 60 },
      value: draft.values.cooldownMinutes,
      onChange: (value) => draft.set('cooldownMinutes', value as number),
    })
  }

  const message: SettingDeclaration[] = [
    {
      id: 'telegram-media',
      label: 'Ce qui est envoyé',
      nature: { kind: 'choice', options: MEDIA_MODE_OPTIONS },
      help: 'La vidéo arrive quelques secondes après la photo, le temps que l’enregistrement se termine.',
      value: draft.values.mediaMode,
      onChange: (value) => draft.set('mediaMode', value as MediaMode),
    },
    {
      id: 'telegram-fields',
      label: 'Détails du message',
      nature: { kind: 'multiChoice', options: [...MESSAGE_FIELD_OPTIONS] },
      value: draft.values.messageFields,
      onChange: (value) => draft.set('messageFields', value as string[]),
    },
  ]

  const configured = Boolean(config?.hasToken && config?.chatId)

  return (
    <>
      <SettingsPage lede="Comment Vyzio vous prévient quand il détecte quelque chose.">
        <SettingsSection title="Telegram" lede={describeChannel(config)}>
          <SettingsList settings={channel} />

          {/* Tester et supprimer agissent tout de suite : ils n'ont rien a faire
              dans le brouillon. */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={testing.loading || !configured}
              title={configured ? undefined : 'Enregistrez la clé et l’identifiant avant de tester'}
              onClick={() => void testing.run()}
            >
              {testing.loading ? 'Envoi…' : 'Envoyer un message de test'}
            </Button>
            {config?.hasToken && (
              <Button type="button" variant="destructive" onClick={() => setConfirmRemove(true)}>
                Supprimer le canal
              </Button>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Obtenir ces informations"
          lede="Quatre étapes dans Telegram, une seule fois."
        >
          <TelegramSetupSteps />
        </SettingsSection>

        <SettingsSection title="Quand prévenir">
          <SettingsList settings={when} />
        </SettingsSection>

        <SettingsSection title="Contenu du message">
          <SettingsList settings={message} />
        </SettingsSection>

        <SettingsSection title="Derniers envois">
          <NotificationLog channel={CHANNEL} />
        </SettingsSection>
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving.loading}
        onSave={save}
        onDiscard={draft.discard}
      />

      {confirmEnable && (
        <ConfirmModal
          title="Envoyer les alertes par Telegram ?"
          body="Les photos, vidéos et noms de caméras seront transmis aux serveurs de Telegram, qui en aura connaissance. Vos données ne resteront plus strictement chez vous."
          confirmLabel="Activer"
          cancelLabel="Annuler"
          tone="warn"
          loading={saving.loading}
          onConfirm={async () => {
            await saving.run()
            setConfirmEnable(false)
          }}
          onCancel={() => setConfirmEnable(false)}
        />
      )}

      {confirmRemove && (
        <ConfirmModal
          title="Supprimer le canal Telegram ?"
          body="La clé et l’identifiant seront effacés. Vous ne recevrez plus d’alertes tant que le canal n’est pas reconfiguré."
          confirmLabel="Supprimer"
          tone="danger"
          loading={removing.loading}
          onConfirm={async () => {
            await removing.run()
            setConfirmRemove(false)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </>
  )
}

/** Channel status in one sentence, right where it's configured. */
function describeChannel(config: NotificationChannelConfig | null): string {
  if (!config?.hasToken || !config.chatId) return 'Pas encore configuré.'
  if (!config.isEnabled) return 'Configuré, mais aucune alerte n’est envoyée.'
  return 'Les alertes sont envoyées.'
}
