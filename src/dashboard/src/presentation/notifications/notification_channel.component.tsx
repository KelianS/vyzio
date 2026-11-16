import { useEffect, useReducer } from 'react'
import { Link, useParams } from 'react-router'
import { Send } from 'lucide-react'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import { AdvancedPage, AdvancedRow } from '../../common/settings/advanced'
import { HelpNotes, HelpQuestion } from '../../common/components/help_notes'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useToast } from '../../common/components/toast'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { DeleteAction } from '../../common/components/delete_action'
import { ReadFailure } from '../../common/components/error_message'
import { ScheduleCountLine } from '../../common/schedule/schedule_count_line'
import { GroupedList } from '../../common/components/grouped_list'
import { ScheduleRuleKind } from '../../domain/entities/schedule_rule.entity'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import {
  parseNotificationChannelName,
  type MediaMode,
  type NotificationChannelConfig,
} from '../../domain/entities/notification_channel_config.entity'
import { useGoBack } from '../../common/navigation/use_go_back'
import { PageHeader } from '../../common/components/page_header'
import { NotificationLog } from './components/notification_log'
import { CommandJournal } from './components/command_journal'
import { ChannelPairingSection } from './components/channel_pairing_section'
import { ChannelSetupSteps } from './components/channel_setup_steps'
import { buildNotificationChannelPresenter } from './notification_channel.presenter'
import { notificationChannelReducer } from './notification_channel.reducer'
import { SecondaryButton } from '../../common/components/secondary_button'
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
import { Loading } from '../../common/components/loading'

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

/** Second level of the Notifications rubric: one channel, whichever it is (ADR-14, UI-25), or its Avancé page. */
export function NotificationChannelView({ advanced = false }: { advanced?: boolean }) {
  const { channel: slug } = useParams()
  const channel = parseNotificationChannelName(slug)
  const { notifications: container, schedules: schedulesContainer } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    notificationChannelReducer,
    undefined,
    buildInitialNotificationChannelUido,
  )
  const presenter = usePresenter(buildNotificationChannelPresenter, {
    container,
    schedulesContainer,
    dispatch,
    toast,
  })

  useEffect(() => {
    if (channel) presenter.onLoad(channel)
  }, [presenter, channel])

  // An unread channel says nothing about it: "not found" would be a false answer.
  if (channel && uido.configError) {
    return (
      <SettingsPage>
        <h1 className="text-title">Ce canal ne s’affiche pas</h1>
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
        <h1 className="text-title">Canal introuvable</h1>
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
    return (
      <SettingsPage>
        <Loading />
      </SettingsPage>
    )
  }

  return advanced ? (
    <ChannelAdvancedForm key={channel} config={uido.config} uido={uido} presenter={presenter} />
  ) : (
    <ChannelForm key={channel} config={uido.config} uido={uido} presenter={presenter} />
  )
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
  const goBack = useGoBack()
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

  // A first configuration ships images off the local network: asked once, at save (NOTIF-04).
  async function save() {
    if (await presenter.onSave(config, draft.values)) draft.accept()
  }

  const channelSettings: SettingDeclaration[] = [
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
              label: label.displayName,
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
  ]

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

  const testable = config.isConfigured && !draft.dirty

  return (
    <>
      <div className="flex flex-col gap-4">
        <PageHeader title={config.displayName} />

        <SettingsPage>
          <SettingsSection
            title="Connexion"
            lede={config.isConfigured ? undefined : 'Pas encore configuré.'}
          >
            <SettingsList settings={channelSettings} />

            {/* Testing acts at once: it has no place in the draft. */}
            <div className="mt-5">
              <SecondaryButton
                icon={Send}
                type="button"
                disabled={uido.testing || !testable}
                title={testable ? undefined : 'Enregistrez la configuration avant de tester'}
                onClick={() => void presenter.onTest(channel)}
              >
                {uido.testing ? 'Envoi…' : 'Envoyer un message de test'}
              </SecondaryButton>
            </div>

            {/* Unfolded while nothing is configured: the walkthrough is then the task, not a fallback. */}
            <HelpNotes>
              <HelpQuestion
                title={`Où trouver ces informations dans ${config.displayName} ?`}
                defaultOpen={!config.isConfigured}
              >
                <ChannelSetupSteps channel={config.channel} />
              </HelpQuestion>
            </HelpNotes>
          </SettingsSection>

          {config.acceptsCommands && (
            <SettingsSection title="Commander depuis la conversation">
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
                  <Loading lines={1} />
                )}
              </div>
            )}
            <SettingsList settings={when} />
            {/* Outside the list: a count and a link are not a setting (ADR-15). */}
            <GroupedList>
              <ScheduleCountLine
                rules={uido.rules}
                kind={ScheduleRuleKind.MuteNotifications}
                targetId={channel}
                error={uido.rulesError}
                onRetry={presenter.onRetryRules}
              />
            </GroupedList>
          </SettingsSection>

          {config.isConfigured && (
            <AdvancedRow to={`/settings/notifications/${channel}/advanced`} />
          )}

          {config.isConfigured && (
            <DeleteAction
              label="Supprimer le canal"
              question={`Supprimer le canal ${config.displayName} ?`}
              consequence="Les informations de connexion seront effacées. Vous ne recevrez plus de notifications par ce canal tant qu’il n’est pas reconfiguré."
              confirming={uido.confirmRemove}
              deleting={uido.removing}
              onAsk={presenter.onAskRemove}
              onConfirm={async () => {
                if (!(await presenter.onRemove(channel))) return
                draft.discard()
                goBack('/settings/notifications')
              }}
              onCancel={presenter.onCancelRemove}
            />
          )}

          <HelpNotes>
            {config.acceptsCommands && (
              <HelpQuestion title="Que puis-je demander, une fois relié ?">
                <p>
                  Envoyez <code className="rounded bg-muted px-1 py-0.5 text-label">/aide</code>{' '}
                  dans la conversation reliée : le bot répond lui-même la liste de ce qu’il sait
                  faire, toujours à jour.
                </p>
                <p>
                  Une seule conversation à la fois : en relier une nouvelle remplace la précédente.
                  Un code cesse de valoir passé quelques minutes, ou après plusieurs essais
                  infructueux : dans les deux cas, générez-en un autre ici.
                </p>
              </HelpQuestion>
            )}

            <HelpQuestion title="Pourquoi une notification n’est-elle pas partie ?">
              <p>Une détection n’est envoyée sur ce canal que si tout est vrai à la fois :</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>le canal est entièrement renseigné ;</li>
                <li>la catégorie détectée fait partie de celles qu’il notifie ;</li>
                <li>la certitude atteint le seuil ;</li>
                <li>aucun Silence n’est en cours, lancé depuis l’accueil ou par une plage ;</li>
                <li>aucun envoi récent ne le fait taire ;</li>
                <li>l’événement ne lui a pas déjà été envoyé.</li>
              </ul>
              <p>
                Les notifications ont besoin d’Internet : sans connexion, Vyzio continue de détecter
                et d’enregistrer chez vous, mais rien ne part. <em>Derniers envois</em>, dans
                <em>Avancé</em>, montre ce qui est réellement parti et l’erreur en cas d’échec.
              </p>
            </HelpQuestion>
          </HelpNotes>
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
          confirmLabel="Envoyer"
          cancelLabel="Annuler"
          tone="warn"
          loading={uido.saving}
          onConfirm={async () => {
            if (await presenter.onConfirmEnable(config, draft.values)) draft.accept()
          }}
          onCancel={presenter.onCancelEnable}
        />
      )}
    </>
  )
}

/** The channel's rare part: what its message carries, and what was sent or asked (UI-09). */
function ChannelAdvancedForm({
  config,
  uido,
  presenter,
}: {
  config: NotificationChannelConfig
  uido: NotificationChannelUido
  presenter: ReturnType<typeof buildNotificationChannelPresenter>
}) {
  const { channel, acceptsCommands } = config

  useEffect(() => {
    presenter.onOpen(channel, acceptsCommands)
  }, [presenter, channel, acceptsCommands])

  const draft = useSettingsDraft<NotificationValues>({
    saved: config.isConfigured ? toNotificationValues(config) : DEFAULT_NOTIFICATION_VALUES,
    labels: notificationDraftLabels(config.channel),
  })

  useUnsavedChanges(draft.dirty)

  const message: SettingDeclaration[] = [
    {
      id: 'channel-media',
      label: 'Ce qui est envoyé',
      // A channel that cannot carry video does not offer it: the capability decides (ADR-14).
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

  return (
    <>
      <AdvancedPage>
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
      </AdvancedPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={uido.saving}
        onSave={async () => {
          if (await presenter.onSave(config, draft.values)) draft.accept()
        }}
        onDiscard={draft.discard}
      />
    </>
  )
}
