import { useEffect, useReducer } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import { AdvancedFold } from '../../common/settings/advanced_fold'
import { midnightRangeHint } from '../../common/settings/midnight_range'
import { HelpPanel } from '../../common/components/help_panel'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useToast } from '../../common/components/toast'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { ReadFailure } from '../../common/components/error_message'
import { Button } from '../../common/ui/button'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import {
  parseNotificationChannelName,
  type MediaMode,
  type NotificationChannelConfig,
} from '../../domain/entities/notification_channel_config.entity'
import { sendingSentence } from './channel_status'
import { NotificationLog } from './components/notification_log'
import { CommandJournal } from './components/command_journal'
import { ChannelPairingSection } from './components/channel_pairing_section'
import { ChannelSetupSteps } from './components/channel_setup_steps'
import { buildNotificationChannelPresenter } from './notification_channel.presenter'
import { notificationChannelReducer } from './notification_channel.reducer'
import {
  buildInitialNotificationChannelUido,
  type NotificationChannelUido,
} from './notification_channel.uido'
import {
  credentialCopy,
  DEFAULT_NOTIFICATION_VALUES,
  notificationDraftLabels,
  toNotificationValues,
  type NotificationValues,
} from './notification_settings'

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

const TRIGGERS_LABEL = 'Ce qui déclenche une notification'

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: hourLabel(hour),
}))

/** Second level of the Notifications rubric: one channel, whichever it is (ADR-40, ADR-50). */
export function NotificationChannelView() {
  const { channel: slug } = useParams()
  const channel = parseNotificationChannelName(slug)
  const { notifications: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    notificationChannelReducer,
    undefined,
    buildInitialNotificationChannelUido,
  )
  const presenter = usePresenter(buildNotificationChannelPresenter, { container, dispatch, toast })

  useEffect(() => {
    if (channel) presenter.onLoad(channel)
  }, [presenter, channel])

  // An unread channel says nothing about it: "not found" would be a false answer.
  if (channel && uido.configError) {
    return (
      <SettingsPage>
        <h1 className="font-serif text-3xl">Ce canal ne s’affiche pas</h1>
        <ReadFailure
          error={uido.configError}
          onRetry={() => presenter.onLoad(channel)}
          className="mt-3"
        />
        <Link
          to="/settings/notifications"
          className="mt-3 inline-block underline underline-offset-2"
        >
          Revenir aux notifications
        </Link>
      </SettingsPage>
    )
  }

  if (!channel || (!uido.configLoading && !uido.config)) {
    return (
      // This route announces that it carries its own header: with no channel to name,
      // the failure has to do it, or the page would stay anonymous.
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

  if (uido.configLoading || !uido.config) {
    return <SettingsPage>Chargement…</SettingsPage>
  }

  return <ChannelForm key={channel} config={uido.config} uido={uido} presenter={presenter} />
}

function ChannelForm({
  config,
  uido,
  presenter,
}: {
  config: NotificationChannelConfig
  uido: NotificationChannelUido
  presenter: ReturnType<typeof buildNotificationChannelPresenter>
}) {
  const navigate = useNavigate()
  const { channel, acceptsCommands } = config

  // The sections below the settings read on mount, as they did when each fetched its own.
  useEffect(() => {
    presenter.onOpen(channel, acceptsCommands)
  }, [presenter, channel, acceptsCommands])

  const draft = useSettingsDraft<NotificationValues>({
    saved: config.isConfigured ? toNotificationValues(config) : DEFAULT_NOTIFICATION_VALUES,
    labels: notificationDraftLabels(config.channel),
  })

  useUnsavedChanges(draft.dirty)

  // Enabling ships images off the local network: asked once, at save, never on the toggle itself.
  async function save() {
    if (await presenter.onSave(config, draft.values)) draft.accept()
  }

  const channelSettings: SettingDeclaration[] = [
    {
      id: 'channel-enabled',
      label: `Notifications ${config.displayName}`,
      nature: { kind: 'toggle' },
      consequence: `Photos, vidéos et noms de caméras transitent par les serveurs de ${config.displayName} : ces images quittent votre réseau.`,
      value: draft.values.enabled,
      onChange: (value) => draft.set('enabled', value as boolean),
    },
    // What the channel asks for, it declares: the screen knows no channel of its own.
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

  // Offered only once read: an empty choice would pass for nothing to be notified.
  const labelsRead = !uido.labelsLoading && !uido.labelsError
  const triggers: SettingDeclaration[] = labelsRead
    ? [
        {
          id: 'channel-labels',
          label: TRIGGERS_LABEL,
          nature: {
            kind: 'multiChoice',
            options: uido.labels.map((label) => ({
              value: label.value,
              label: `${label.emoji} ${label.displayName}`,
            })),
          },
          help: 'Seules les catégories cochées vous sont notifiées. Les autres restent détectées et consultables dans l’historique.',
          value: draft.values.allowedLabels,
          onChange: (value) => draft.set('allowedLabels', value as string[]),
        },
      ]
    : []

  // Same order as detection: what is concerned first, the threshold next.
  const when: SettingDeclaration[] = [
    ...triggers,
    {
      id: 'channel-confidence',
      label: 'Certitude minimale',
      nature: { kind: 'range', unit: '%', min: 50, max: 99 },
      help: 'En dessous, la détection n’est pas notifiée. Trop bas, vous recevrez de fausses notifications ; trop haut, des détections réelles passeront sous silence.',
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
        // A range ending before it starts crosses midnight, the common case worth stating.
        consequence:
          draft.values.fromHour > draft.values.toHour
            ? midnightRangeHint(hourLabel(draft.values.toHour))
            : undefined,
        value: String(draft.values.toHour),
        onChange: (value) => draft.set('toHour', Number(value)),
      },
    )
  }

  when.push({
    id: 'channel-cooldown-on',
    label: 'Espacer les notifications répétées',
    nature: { kind: 'toggle' },
    help: 'Sans cela, une personne qui reste dans le champ peut déclencher plusieurs notifications de suite.',
    value: draft.values.limitRepeats,
    onChange: (value) => draft.set('limitRepeats', value as boolean),
  })

  if (draft.values.limitRepeats) {
    when.push({
      id: 'channel-cooldown',
      label: 'Silence après une notification',
      nature: { kind: 'number', unit: 'minutes', min: 1, max: 60 },
      value: draft.values.cooldownMinutes,
      onChange: (value) => draft.set('cooldownMinutes', value as number),
    })
  }

  const message: SettingDeclaration[] = [
    {
      id: 'channel-media',
      label: 'Ce qui est envoyé',
      // A channel that cannot carry video does not offer it: the capability decides (ADR-50).
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
                disabled={uido.testing || !testable}
                title={testable ? undefined : 'Enregistrez la configuration avant de tester'}
                onClick={() => void presenter.onTest(channel)}
              >
                {uido.testing ? 'Envoi…' : 'Envoyer un message de test'}
              </Button>
              {config.isConfigured && (
                <Button type="button" variant="destructive" onClick={presenter.onAskRemove}>
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
              {uido.pairingError ? (
                <ReadFailure
                  error={uido.pairingError}
                  onRetry={() => presenter.onRetryPairing(channel)}
                  subject="Vyzio n’a pas pu lire si une conversation est reliée à ce canal."
                />
              ) : (
                <ChannelPairingSection
                  displayName={config.displayName}
                  pairing={uido.pairing}
                  pairingLoading={uido.pairingLoading}
                  listening={uido.listening}
                  listeningLoading={uido.listeningLoading}
                  listeningError={uido.listeningError}
                  starting={uido.startingPairing}
                  confirmRevoke={uido.confirmRevoke}
                  revoking={uido.revoking}
                  onStart={() => void presenter.onStartPairing(channel)}
                  onAskRevoke={presenter.onAskRevoke}
                  onCancelRevoke={presenter.onCancelRevoke}
                  onRevoke={() => void presenter.onRevoke(channel)}
                  onRetryListening={() => presenter.onRetryListening(channel)}
                  onRefresh={() => presenter.onRefreshPairing(channel, uido.listening !== null)}
                />
              )}

              <HelpPanel title="Que puis-je demander, une fois relié ?">
                <p>
                  Envoyez <code className="rounded bg-muted px-1 py-0.5 text-xs">/aide</code> dans
                  la conversation reliée : le bot répond lui-même la liste de ce qu’il sait faire,
                  toujours à jour.
                </p>
                <p>
                  Une seule conversation à la fois : en relier une nouvelle remplace la précédente.
                  Un code cesse de valoir passé quelques minutes, ou après plusieurs essais
                  infructueux : dans les deux cas, générez-en un autre ici.
                </p>
              </HelpPanel>
            </SettingsSection>
          )}

          <SettingsSection title="Quand notifier">
            {!labelsRead && (
              <div className="py-3">
                <p className="font-medium">{TRIGGERS_LABEL}</p>
                {uido.labelsError ? (
                  <ReadFailure
                    error={uido.labelsError}
                    onRetry={presenter.onRetryLabels}
                    className="mt-2"
                  />
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Chargement…</p>
                )}
              </div>
            )}
            <SettingsList settings={when} />

            <HelpPanel title="Pourquoi une notification n’est-elle pas partie ?">
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
                Les notifications ont besoin d’Internet : sans connexion, Vyzio continue de détecter
                et d’enregistrer chez vous, mais rien ne part. <em>Derniers envois</em>, dans le
                repli <em>Avancé</em>, montre ce qui est réellement parti et l’erreur en cas
                d’échec.
              </p>
            </HelpPanel>
          </SettingsSection>

          <AdvancedFold>
            <SettingsSection title="Contenu du message">
              <SettingsList settings={message} />
            </SettingsSection>

            <SettingsSection title="Derniers envois">
              {uido.logError ? (
                <ReadFailure error={uido.logError} onRetry={() => presenter.onRetryLog(channel)} />
              ) : (
                <NotificationLog
                  entries={uido.log}
                  loading={uido.logLoading}
                  onRefresh={() => presenter.onRefreshLog(channel)}
                />
              )}
            </SettingsSection>

            {config.acceptsCommands && (
              <SettingsSection title="Dernières commandes">
                {uido.journalError ? (
                  <ReadFailure
                    error={uido.journalError}
                    onRetry={() => presenter.onRetryJournal(channel)}
                  />
                ) : (
                  <CommandJournal
                    entries={uido.journal}
                    loading={uido.journalLoading}
                    onRefresh={() => presenter.onRefreshJournal(channel)}
                  />
                )}
              </SettingsSection>
            )}
          </AdvancedFold>
        </SettingsPage>
      </div>

      <SettingsDraftBar
        changes={draft.changes}
        saving={uido.saving}
        onSave={save}
        onDiscard={draft.discard}
      />

      {uido.confirmEnable && (
        <ConfirmModal
          title={`Envoyer les notifications par ${config.displayName} ?`}
          body={`Les photos, vidéos et noms de caméras seront transmis aux serveurs de ${config.displayName}, qui en aura connaissance. Vos données ne resteront plus strictement chez vous.`}
          confirmLabel="Activer"
          cancelLabel="Annuler"
          tone="warn"
          loading={uido.saving}
          onConfirm={async () => {
            if (await presenter.onConfirmEnable(config, draft.values)) draft.accept()
          }}
          onCancel={presenter.onCancelEnable}
        />
      )}

      {uido.confirmRemove && (
        <ConfirmModal
          title={`Supprimer le canal ${config.displayName} ?`}
          body="Les informations de connexion seront effacées. Vous ne recevrez plus de notifications par ce canal tant qu’il n’est pas reconfiguré."
          confirmLabel="Supprimer"
          tone="danger"
          loading={uido.removing}
          onConfirm={async () => {
            if (!(await presenter.onRemove(channel))) return
            draft.discard()
            void navigate('/settings/notifications')
          }}
          onCancel={presenter.onCancelRemove}
        />
      )}
    </>
  )
}

/** Channel status in one sentence, right where it's configured. */
function describeChannel(config: NotificationChannelConfig): string {
  if (!config.isConfigured) return 'Pas encore configuré.'
  return sendingSentence(config.isEnabled)
}
