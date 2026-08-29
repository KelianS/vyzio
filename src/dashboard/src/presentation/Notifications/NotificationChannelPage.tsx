import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { SettingsList } from '../../common/settings/SettingsList'
import { AdvancedFold } from '../../common/settings/AdvancedFold'
import { HelpPanel } from '../../common/settings/HelpPanel'
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
import {
  parseNotificationChannelName,
  type MediaMode,
  type NotificationChannelConfig,
} from '../../domain/entities/NotificationChannelConfig'
import { NotificationLog } from './NotificationLog'
import { ChannelPairingSection } from './ChannelPairingSection'
import { ChannelSetupSteps } from './ChannelSetupSteps'
import {
  credentialCopy,
  DEFAULT_NOTIFICATION_VALUES,
  notificationDraftLabels,
  toNotificationValues,
  toSaveRequest,
  type NotificationValues,
} from './notificationSettings'

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

/** Second level of the Notifications rubric: one channel, whichever it is (ADR-40, ADR-50). */
export function NotificationChannelPage() {
  const { channel: slug } = useParams()
  const channel = parseNotificationChannelName(slug)
  const { notifications: container } = useAppContainer()

  const config = useAsync(
    async () => (channel ? container.getNotificationChannelConfig.execute(channel) : null),
    [channel],
  )
  const labels = useAsync(() => container.getNotificationLabels.execute(), [])

  if (!channel || (!config.loading && !config.data)) {
    return (
      // Cette route annonce porter son propre en-tete : sans canal a nommer,
      // c'est a l'echec de le faire, sinon la page resterait anonyme.
      <SettingsPage>
        <h1 className="font-serif text-3xl">Canal introuvable</h1>
        <Link
          to="/settings/notifications"
          className="mt-3 inline-block underline underline-offset-2"
        >
          Revenir aux notifications
        </Link>
      </SettingsPage>
    )
  }

  if (config.loading || labels.loading || !config.data) {
    return <SettingsPage>Chargement…</SettingsPage>
  }

  return (
    <ChannelForm
      key={channel}
      config={config.data}
      labels={labels.data ?? []}
      reload={config.reload}
    />
  )
}

function ChannelForm({
  config,
  labels,
  reload,
}: {
  config: NotificationChannelConfig
  labels: DetectionLabel[]
  reload: () => void
}) {
  const { notifications: container } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [confirmEnable, setConfirmEnable] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const draft = useSettingsDraft<NotificationValues>({
    saved: config.isConfigured ? toNotificationValues(config) : DEFAULT_NOTIFICATION_VALUES,
    labels: notificationDraftLabels(config.channel),
  })

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(
    async () =>
      container.saveNotificationChannelConfig.execute(
        config.channel,
        toSaveRequest(draft.values, config.credentials),
      ),
    {
      onSuccess: () => {
        draft.accept()
        toast('Notifications enregistrées.', 'success')
        reload()
      },
    },
  )

  const testing = useAsyncAction(
    async () => container.testNotificationChannel.execute(config.channel),
    {
      onSuccess: (result) => {
        toast(
          result?.success
            ? 'Message envoyé : le canal fonctionne.'
            : `Échec de l’envoi — ${result?.errorMessage ?? 'raison inconnue'}.`,
          result?.success ? 'success' : 'error',
        )
        reload()
      },
    },
  )

  const removing = useAsyncAction(
    async () => container.deleteNotificationChannel.execute(config.channel),
    {
      onSuccess: () => {
        toast('Canal supprimé.', 'info')
        draft.discard()
        void navigate('/settings/notifications')
      },
    },
  )

  // Enabling ships images off the local network: asked once, at save, never on the toggle itself.
  function save() {
    if (draft.values.enabled && !config.isEnabled) {
      setConfirmEnable(true)
      return
    }
    void saving.run()
  }

  const channelSettings: SettingDeclaration[] = [
    {
      id: 'channel-enabled',
      label: `Alertes ${config.displayName}`,
      nature: { kind: 'toggle' },
      consequence: `Photos, vidéos et noms de caméras transitent par les serveurs de ${config.displayName} : ces images quittent votre réseau.`,
      value: draft.values.enabled,
      onChange: (value) => draft.set('enabled', value as boolean),
    },
    // Ce que le canal demande, il le declare : l'ecran ne connait aucun canal en propre.
    ...config.credentials.map((credential): SettingDeclaration => {
      const copy = credentialCopy(config.channel, credential.field)
      return {
        id: `channel-${credential.field}`,
        label: copy.label,
        nature: credential.secret
          ? { kind: 'secret', placeholder: credential.isSet ? 'Inchangée' : copy.placeholder }
          : { kind: 'text', placeholder: copy.placeholder },
        help: copy.help,
        value: draft.values[credential.field],
        onChange: (value) => draft.set(credential.field, value as string),
      }
    }),
  ]

  // Meme ordre que la detection : ce qui est concerne d'abord, le seuil ensuite.
  const when: SettingDeclaration[] = [
    {
      id: 'channel-labels',
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
      id: 'channel-confidence',
      label: 'Certitude minimale',
      nature: { kind: 'range', unit: '%', min: 50, max: 99 },
      help: 'En dessous, la détection n’est pas notifiée. Trop bas, vous recevrez des fausses alertes ; trop haut, des détections réelles passeront sous silence.',
      value: draft.values.minimumConfidence,
      onChange: (value) => draft.set('minimumConfidence', value as number),
    },
    {
      id: 'channel-hours',
      label: 'Seulement à certaines heures',
      nature: { kind: 'toggle' },
      value: draft.values.restrictHours,
      onChange: (value) => draft.set('restrictHours', value as boolean),
    },
  ]

  if (draft.values.restrictHours) {
    when.push(
      {
        id: 'channel-from',
        label: 'À partir de',
        nature: { kind: 'choice', options: HOUR_OPTIONS },
        value: String(draft.values.fromHour),
        onChange: (value) => draft.set('fromHour', Number(value)),
      },
      {
        id: 'channel-to',
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
    id: 'channel-cooldown-on',
    label: 'Espacer les alertes répétées',
    nature: { kind: 'toggle' },
    help: 'Sans cela, une personne qui reste dans le champ peut déclencher plusieurs alertes de suite.',
    value: draft.values.limitRepeats,
    onChange: (value) => draft.set('limitRepeats', value as boolean),
  })

  if (draft.values.limitRepeats) {
    when.push({
      id: 'channel-cooldown',
      label: 'Silence après une alerte',
      nature: { kind: 'number', unit: 'minutes', min: 1, max: 60 },
      value: draft.values.cooldownMinutes,
      onChange: (value) => draft.set('cooldownMinutes', value as number),
    })
  }

  const message: SettingDeclaration[] = [
    {
      id: 'channel-media',
      label: 'Ce qui est envoyé',
      // Un canal qui ne sait pas porter de video ne l'offre pas : la capacite decide (ADR-50).
      nature: {
        kind: 'choice',
        options: MEDIA_MODE_OPTIONS.filter(
          (option) => option.value !== 'clip_or_photo' || config.capabilities.video,
        ),
      },
      help: config.capabilities.video
        ? 'La vidéo arrive quelques secondes après la photo, le temps que l’enregistrement se termine. Si elle n’est pas prête, la photo part seule ; si la photo manque aussi, le message part en texte.'
        : undefined,
      value: draft.values.mediaMode,
      onChange: (value) => draft.set('mediaMode', value as MediaMode),
    },
    {
      id: 'channel-fields',
      label: 'Détails du message',
      nature: { kind: 'multiChoice', options: [...MESSAGE_FIELD_OPTIONS] },
      value: draft.values.messageFields,
      onChange: (value) => draft.set('messageFields', value as string[]),
    },
  ]

  const testable = config.isConfigured && !draft.dirty

  return (
    <>
      <div className="flex flex-col gap-4">
        <div>
          <Link
            to="/settings/notifications"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Notifications
          </Link>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-serif text-3xl">{config.displayName}</h1>
            <span className="text-sm text-muted-foreground">{describeChannel(config)}</span>
          </div>
        </div>

        <SettingsPage>
          <SettingsSection title="Connexion">
            <SettingsList settings={channelSettings} />

            {/* Tester et supprimer agissent tout de suite : ils n'ont rien a faire
                dans le brouillon. */}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={testing.loading || !testable}
                title={testable ? undefined : 'Enregistrez la configuration avant de tester'}
                onClick={() => void testing.run()}
              >
                {testing.loading ? 'Envoi…' : 'Envoyer un message de test'}
              </Button>
              {config.isConfigured && (
                <Button type="button" variant="destructive" onClick={() => setConfirmRemove(true)}>
                  Supprimer le canal
                </Button>
              )}
            </div>

            {/* Unfolded while nothing is configured: the walkthrough is then the task, not a fallback. */}
            <HelpPanel
              title={`Où trouver ces informations dans ${config.displayName} ?`}
              defaultOpen={!config.isConfigured}
            >
              <ChannelSetupSteps channel={config.channel} />
            </HelpPanel>
          </SettingsSection>

          {config.acceptsCommands && (
            <SettingsSection
              title="Commander depuis la conversation"
              lede="Reliez une conversation à votre installation pour lui demander, depuis votre téléphone, ce qui se passe chez vous."
            >
              <ChannelPairingSection channel={config.channel} displayName={config.displayName} />

              <HelpPanel title="Que puis-je demander, une fois relié ?">
                <p>
                  Envoyez <code className="rounded bg-muted px-1 py-0.5 text-xs">/aide</code> dans
                  la conversation reliée : le bot répond lui-même la liste de ce qu’il sait faire,
                  toujours à jour.
                </p>
                <p>
                  Une seule conversation à la fois : en relier une nouvelle remplace la précédente.
                  Un code cesse de valoir passé quelques minutes, ou après plusieurs essais
                  infructueux — dans les deux cas, générez-en un autre ici.
                </p>
              </HelpPanel>
            </SettingsSection>
          )}

          <SettingsSection title="Quand prévenir">
            <SettingsList settings={when} />

            <HelpPanel title="Pourquoi une alerte n’est-elle pas partie ?">
              <p>Une détection n’est envoyée sur ce canal que si tout est vrai à la fois :</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>le canal est activé et entièrement renseigné ;</li>
                <li>la catégorie détectée fait partie de celles qu’il notifie ;</li>
                <li>la certitude atteint le seuil ;</li>
                <li>l’heure est dans la plage, s’il y en a une ;</li>
                <li>aucun envoi récent ne le fait taire ;</li>
                <li>l’événement ne lui a pas déjà été envoyé.</li>
              </ul>
              <p>
                Les alertes ont besoin d’Internet : sans connexion, Vyzio continue de détecter et
                d’enregistrer chez vous, mais rien ne part. <em>Derniers envois</em>, dans le repli{' '}
                <em>Avancé</em>, montre ce qui est réellement parti et l’erreur en cas d’échec.
              </p>
            </HelpPanel>
          </SettingsSection>

          <AdvancedFold>
            <SettingsSection title="Contenu du message">
              <SettingsList settings={message} />
            </SettingsSection>

            <SettingsSection title="Derniers envois">
              <NotificationLog channel={config.channel} />
            </SettingsSection>
          </AdvancedFold>
        </SettingsPage>
      </div>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving.loading}
        onSave={save}
        onDiscard={draft.discard}
      />

      {confirmEnable && (
        <ConfirmModal
          title={`Envoyer les alertes par ${config.displayName} ?`}
          body={`Les photos, vidéos et noms de caméras seront transmis aux serveurs de ${config.displayName}, qui en aura connaissance. Vos données ne resteront plus strictement chez vous.`}
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
          title={`Supprimer le canal ${config.displayName} ?`}
          body="Les informations de connexion seront effacées. Vous ne recevrez plus d’alertes par ce canal tant qu’il n’est pas reconfiguré."
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
function describeChannel(config: NotificationChannelConfig): string {
  if (!config.isConfigured) return 'Pas encore configuré.'
  if (!config.isEnabled) return 'Configuré, mais aucune alerte n’est envoyée.'
  return 'Les alertes sont envoyées.'
}
