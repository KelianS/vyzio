import { Search } from 'lucide-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useGoBack } from '../../common/navigation/use_go_back'
import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useToast } from '../../common/components/toast'
import { DeleteAction } from '../../common/components/delete_action'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { Camera } from '../../domain/entities/camera.entity'
import type { SupportedProtocol } from '../../domain/entities/camera_capability_binding.entity'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { HelpPanel, HelpRow } from '../../common/components/help_panel'
import { GroupedList } from '../../common/components/grouped_list'
import { AdvancedFold } from '../../common/settings/advanced_fold'
import { CapabilitySection } from './components/capability_section'
import { AddProtocol } from './components/add_protocol_form'
import { ProtocolBoxes } from './components/protocol_boxes'
import { CameraNotFound } from './components/camera_not_found'
import { buildCameraConnectionPresenter } from './camera_connection.presenter'
import { cameraConnectionReducer } from './camera_connection.reducer'
import { buildInitialCameraConnectionUido } from './camera_connection.uido'
import { CAPABILITY_LABELS } from './cameras.formatters'
import { otherTestsSuspended, streamBindingOf } from './capability_state'
import { SecondaryButton } from '../../common/components/secondary_button'
import {
  ALL_PROTOCOLS,
  connectionValuesOf,
  protocolKey,
  sameBox,
  type ConnectionValues,
  type ProtocolKey,
  type ProtocolValues,
} from './camera_connection_values'

// Protocol names stay out of the draft bar, which sits outside every fold (UI-02).
const PROTOCOL_DRAFT_LABELS = Object.fromEntries(
  ALL_PROTOCOLS.map((protocol) => [protocolKey(protocol), 'Protocoles']),
) as Record<ProtocolKey, string>

const DRAFT_LABELS: Record<keyof ConnectionValues, string> = {
  displayName: 'Nom',
  host: 'Adresse',
  username: 'Identifiant',
  password: 'Mot de passe',
  ...PROTOCOL_DRAFT_LABELS,
}

export function CameraConnectionView() {
  const camera = useOutletContext<Camera>()
  const { cameras: container, hub: hubContainer } = useAppContainer()
  const { toast } = useToast()
  const goBack = useGoBack()
  const [uido, dispatch] = useReducer(
    cameraConnectionReducer,
    undefined,
    buildInitialCameraConnectionUido,
  )
  const presenter = usePresenter(buildCameraConnectionPresenter, {
    container,
    hubContainer,
    dispatch,
    toast,
  })

  const cameraId = camera.id

  useEffect(() => {
    presenter.onLoad(cameraId)
  }, [presenter, cameraId])

  const neverDetected = camera.detectedAt === null
  const host = camera.host
  useEffect(() => {
    presenter.onArrive(cameraId, host, neverDetected)
  }, [presenter, cameraId, host, neverDetected])

  const saved = useMemo(() => connectionValuesOf(camera, uido.protocols), [camera, uido.protocols])
  const draft = useSettingsDraft<ConnectionValues>({ saved, labels: DRAFT_LABELS })

  useUnsavedChanges(draft.dirty)

  /** Back to its saved content, a box drops its edit, so a later re-read never mistakes it for a change. */
  function setProtocol(protocol: SupportedProtocol, patch: Partial<ProtocolValues>) {
    const key = protocolKey(protocol)
    const next = { ...draft.values[key], ...patch }
    if (sameBox(next, draft.saved[key])) draft.revert(key)
    else draft.set(key, next)
  }

  // The name is the camera's identity, not a capability: it stays at the top of the page.
  const identity: SettingDeclaration[] = [
    {
      id: 'connection-name',
      label: 'Nom',
      nature: { kind: 'text' },
      value: draft.values.displayName,
      onChange: (value) => draft.set('displayName', value as string),
    },
  ]

  // How Vyzio reaches the camera itself: rare, in the Avancé fold (DESIGN SYSTEM § Folds).
  const access: SettingDeclaration[] = [
    {
      id: 'connection-host',
      label: 'Adresse',
      nature: { kind: 'text', placeholder: '192.168.1.50', keyboard: 'address' },
      help: 'L’adresse de la caméra sur votre réseau local. Elle peut changer si votre box la réattribue.',
      value: draft.values.host,
      onChange: (value) => draft.set('host', value as string),
    },
    {
      id: 'connection-username',
      label: 'Identifiant',
      nature: { kind: 'text', keyboard: 'identifier' },
      value: draft.values.username,
      onChange: (value) => draft.set('username', value as string),
    },
    {
      id: 'connection-password',
      label: 'Mot de passe',
      nature: { kind: 'secret', placeholder: 'Inchangé' },
      help: 'Laissez vide pour conserver le mot de passe actuel.',
      value: draft.values.password,
      onChange: (value) => draft.set('password', value as string),
    },
  ]

  // Every other test goes through the stream's camera: while its check does not pass, they wait (CAM-08).
  const testsSuspended = otherTestsSuspended(streamBindingOf(uido.bindings), camera)

  if (uido.cameraGone)
    return (
      <SettingsPage>
        <CameraNotFound within="tab" />
      </SettingsPage>
    )

  return (
    <>
      <SettingsPage>
        <SettingsList settings={identity} />

        {/* Checking or configuring a capability tests a connection and returns a result: an action, not a draft value. */}
        <SettingsSection title="Capacités">
          <CapabilitySection
            camera={camera}
            bindings={uido.bindings}
            protocols={uido.protocols}
            protocolsRead={!uido.protocolsLoading && !uido.protocolsError}
            loading={uido.bindingsLoading}
            readError={uido.bindingsError}
            detecting={uido.detecting}
            detected={uido.detected}
            detection={uido.detection}
            verifyingStream={uido.verifying}
            testsSuspended={testsSuspended}
            pending={uido.pending}
            asking={uido.asking}
            manualFormOpen={uido.manualFormOpen}
            manualConfiguring={uido.manualConfiguring}
            streams={{
              lineup: uido.streams,
              loading: uido.streamsLoading,
              readError: uido.streamsError,
              available: uido.availableStreams,
              availableErrors: uido.availableStreamsErrors,
              tasks: uido.streamTasks,
              formOpen: uido.streamFormOpen,
              adding: uido.addingStream,
              pathAsked: uido.streamPathAsked,
              intents: {
                onRetryRead: () => presenter.onLoad(cameraId),
                onSetRole: (streamId, role) =>
                  void presenter.onSetStreamRole(cameraId, streamId, role),
                onRemove: (streamId) => presenter.onRemoveStream(cameraId, streamId),
                onCheck: (streamId) => void presenter.onCheckStream(cameraId, streamId),
                onListAvailable: (protocol) =>
                  void presenter.onListAvailableStreams(cameraId, protocol),
                onOpenForm: presenter.onOpenStreamForm,
                onCloseForm: presenter.onCloseStreamForm,
                onAdd: (addition) => void presenter.onAddStream(cameraId, addition),
              },
            }}
            intents={{
              onRetryRead: () => presenter.onLoad(cameraId),
              onDetect: () => void presenter.onDetect(cameraId, camera.host),
              onVerifyStream: () => void presenter.onVerify(cameraId),
              onVerify: (capability) => void presenter.onVerifyCapability(cameraId, capability),
              onConfigure: (capability, protocol, streamPath) =>
                presenter.onConfigure(cameraId, capability, protocol, streamPath),
              onTogglePtz: () => presenter.onTogglePtz(camera),
              onSetPanInverted: (inverted) => void presenter.onSetPanInverted(cameraId, inverted),
              onRemove: (capability) => presenter.onRemove(cameraId, capability),
              onTry: (capability) => void presenter.onTry(cameraId, capability),
              onAnswer: (capability, worked) =>
                void presenter.onAnswer(cameraId, capability, worked),
              onOpenManual: presenter.onOpenManual,
              onCloseManual: presenter.onCloseManual,
              onConfigureManually: (capability, protocol) =>
                void presenter.onConfigureManually(cameraId, capability, protocol),
            }}
          />
        </SettingsSection>

        <GroupedList label="Aide">
          <HelpRow title="Une vérification échoue">
            <p>
              Commencez par le flux vidéo : les autres capacités passent par lui. S’il échoue,
              corrigez l’adresse ou le compte de la caméra dans Avancé, en bas de page, ou la façon
              de lire les images dans les options du flux, enregistrez, puis relancez « Vérifier ».
            </p>
            <p>
              Une capacité qui dit que la caméra ne répond pas attend qu’elle soit allumée ; une
              caméra sur batterie se réveille depuis son application. Une capacité dont le compte
              est refusé se corrige dans Avancé.
            </p>
            <p>
              Une capacité dont la vérification échoue n’est jamais proposée comme active, et la
              vérification se relance à tout moment.
            </p>
          </HelpRow>

          <HelpRow title="Une capacité est à confirmer">
            <p>
              Certaines caméras ne permettent pas à Vyzio de lire la preuve d’une capacité. Vyzio ne
              la suppose pas : il vous la fait essayer une fois, et votre réponse décide.
            </p>
            <p>
              Regardez la caméra, ou son image sur un autre écran, avant de lancer « Essayer ». Si
              elle n’a rien fait, répondez « Non » : la capacité reste inutilisée. Vyzio retient
              votre réponse et ne vous repose pas la question de lui-même.
            </p>
            <p>
              Ensuite, « Essayer à nouveau » refait l’essai et repose la question, ses options
              permettent de la joindre autrement, et « Retirer » l’enlève si la caméra ne l’a pas.
            </p>
          </HelpRow>
        </GroupedList>

        <AdvancedFold lede="Comment Vyzio joint cette caméra.">
          <SettingsList settings={access} />

          <SettingsSection title="Protocoles">
            <ProtocolBoxes
              protocols={uido.protocols}
              loading={uido.protocolsLoading}
              readError={uido.protocolsError}
              values={(protocol) => draft.values[protocolKey(protocol)]}
              checking={uido.checking}
              removing={uido.removing}
              usedBy={(protocol) =>
                uido.bindings
                  .filter((b) => b.isConfigured && b.protocol === protocol)
                  .map((b) => CAPABILITY_LABELS[b.capability])
              }
              edited={(protocol) =>
                draft.values[protocolKey(protocol)] !== draft.saved[protocolKey(protocol)]
              }
              onChange={setProtocol}
              onCheck={(protocol) => void presenter.onCheckProtocol(cameraId, protocol)}
              onRemove={(protocol) => presenter.onRemoveProtocol(cameraId, protocol)}
              onRetryRead={() => presenter.onLoad(cameraId)}
            />
            {!uido.protocolsLoading && !uido.protocolsError && (
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton
                  icon={Search}
                  type="button"
                  size="sm"
                  disabled={uido.searchingProtocols}
                  onClick={() => void presenter.onSearchProtocols(cameraId)}
                >
                  {uido.searchingProtocols ? 'Recherche…' : 'Rechercher les protocoles'}
                </SecondaryButton>
                {/* Adding by hand is the way out when the search finds nothing (CAM-48). */}
                <AddProtocol
                  protocols={uido.protocols}
                  open={uido.protocolFormOpen}
                  adding={uido.addingProtocol}
                  onOpen={presenter.onOpenProtocolForm}
                  onClose={presenter.onCloseProtocolForm}
                  onAdd={(addition) => void presenter.onAddProtocol(cameraId, addition)}
                />
              </div>
            )}
          </SettingsSection>

          <HelpPanel title="Un protocole ne répond pas, que vérifier ?">
            <p>
              Chaque protocole passe par son propre port, affiché dans sa case. « Accessible » dit
              que la caméra écoute sur ce port et accepte le compte ; « Accès refusé » dit qu’elle
              écoute mais refuse le compte, ou le numéro de la caméra en V380.
            </p>
            <p>
              Un protocole qui ne répond pas est souvent désactivé dans l’application du fabricant,
              ou la caméra est endormie. Beaucoup de caméras parlent plusieurs protocoles, une ICSee
              répond souvent en DVRIP et en ONVIF : choisissez l’autre dans les options de la
              capacité.
            </p>
            <p>
              Deux limites connues : sur les firmwares d’entrée de gamme, ONVIF répond parfois en
              plusieurs secondes, ce qui rend le pilotage précis difficile ; et l’orientation à
              l’écart, en vie privée, suppose que l’orientation soit déjà vérifiée sur la même
              caméra.
            </p>
          </HelpPanel>
        </AdvancedFold>

        <DeleteAction
          label="Supprimer cette caméra"
          question={`Supprimer « ${camera.displayName} » ?`}
          consequence="Vyzio cesse de surveiller cette caméra. Les enregistrements déjà faits ne sont pas effacés."
          confirming={uido.confirmDelete}
          deleting={uido.deleting}
          onAsk={presenter.onAskDelete}
          onConfirm={async () => {
            if (await presenter.onDelete(cameraId)) goBack('/settings/cameras')
          }}
          onCancel={presenter.onCancelDelete}
        />
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={uido.saving}
        onSave={async () => {
          if (await presenter.onSave(camera, draft.values, draft.saved)) draft.accept()
        }}
        onDiscard={draft.discard}
      />
    </>
  )
}
