import { useEffect, useMemo, useReducer } from 'react'
import { useNavigate, useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useToast } from '../../common/components/toast'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { Button } from '../../common/ui/button'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { Camera } from '../../domain/entities/camera.entity'
import type { SupportedProtocol } from '../../domain/entities/camera_capability_binding.entity'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { AdvancedFold } from '../../common/settings/advanced_fold'
import { CapabilitySection } from './components/capability_section'
import { AddProtocol } from './components/add_protocol_form'
import { ProtocolBoxes } from './components/protocol_boxes'
import { CameraNotFound } from './components/camera_not_found'
import { buildCameraConnectionPresenter } from './camera_connection.presenter'
import { cameraConnectionReducer } from './camera_connection.reducer'
import { buildInitialCameraConnectionUido } from './camera_connection.uido'
import { streamBindingOf } from './capability_state'
import { CAPABILITY_LABELS } from './cameras.formatters'
import {
  ALL_PROTOCOLS,
  connectionValuesOf,
  protocolKey,
  sameBox,
  type ConnectionValues,
  type ProtocolKey,
  type ProtocolValues,
} from './camera_connection_values'

// Protocol names stay out of the draft bar, which sits outside every fold (SPECS 1.5).
const PROTOCOL_DRAFT_LABELS = Object.fromEntries(
  ALL_PROTOCOLS.map((protocol) => [protocolKey(protocol), 'Protocoles']),
) as Record<ProtocolKey, string>

const DRAFT_LABELS: Record<keyof ConnectionValues, string> = {
  displayName: 'Nom',
  host: 'Adresse',
  username: 'Identifiant',
  password: 'Mot de passe',
  streamPath: 'Chemin du flux',
  ...PROTOCOL_DRAFT_LABELS,
}

export function CameraConnectionView() {
  const camera = useOutletContext<Camera>()
  const { cameras: container, hub: hubContainer } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()
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

  const stream = streamBindingOf(uido.bindings)
  const saved = useMemo(
    () => connectionValuesOf(camera, stream, uido.protocols),
    [camera, stream, uido.protocols],
  )
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

  // How Vyzio reaches the camera itself: rare, in the Avancé fold (DESIGN SYSTEM § Capability cards).
  const access: SettingDeclaration[] = [
    {
      id: 'connection-host',
      label: 'Adresse',
      nature: { kind: 'text', placeholder: '192.168.1.50' },
      help: 'L’adresse de la caméra sur votre réseau local. Elle peut changer si votre box la réattribue.',
      value: draft.values.host,
      onChange: (value) => draft.set('host', value as string),
    },
    {
      id: 'connection-username',
      label: 'Identifiant',
      nature: { kind: 'text' },
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

  const streamPath: SettingDeclaration = {
    id: 'connection-stream-path',
    label: 'Chemin du flux',
    nature: { kind: 'text', placeholder: '/stream1' },
    help: 'Vyzio le demande à la caméra quand elle sait répondre. Ne le renseignez que si la caméra n’a pas été reconnue.',
    value: draft.values.streamPath,
    onChange: (value) => draft.set('streamPath', value as string),
  }

  // Every other test goes through the stream's camera: while it fails, they are suspended (SPECS 2.2).
  const testsSuspended = !camera.connected

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
        <SettingsSection title="Capacités" lede="Ce que Vyzio vérifie auprès de cette caméra.">
          <CapabilitySection
            camera={camera}
            bindings={uido.bindings}
            protocols={uido.protocols}
            protocolsRead={!uido.protocolsLoading && !uido.protocolsError}
            loading={uido.bindingsLoading}
            readError={uido.bindingsError}
            detecting={uido.detecting}
            verifyingStream={uido.verifying}
            testsSuspended={testsSuspended}
            pending={uido.pending}
            manualFormOpen={uido.manualFormOpen}
            manualConfiguring={uido.manualConfiguring}
            streamPath={streamPath}
            streams={{
              lineup: uido.streams,
              loading: uido.streamsLoading,
              readError: uido.streamsError,
              tasks: uido.streamTasks,
              formOpen: uido.streamFormOpen,
              adding: uido.addingStream,
              intents: {
                onRetryRead: () => presenter.onLoad(cameraId),
                onSetRole: (streamId, role) =>
                  void presenter.onSetStreamRole(cameraId, streamId, role),
                onSetEnabled: (streamId, enabled) =>
                  presenter.onSetStreamEnabled(cameraId, streamId, enabled),
                onRemove: (streamId) => presenter.onRemoveStream(cameraId, streamId),
                onCheck: (streamId) => void presenter.onCheckStream(cameraId, streamId),
                onOpenForm: presenter.onOpenStreamForm,
                onCloseForm: presenter.onCloseStreamForm,
                onAdd: (addition) => void presenter.onAddStream(cameraId, addition),
              },
            }}
            intents={{
              onRetryRead: () => presenter.onLoad(cameraId),
              onDetect: () => void presenter.onDetect(cameraId),
              onVerifyStream: () => void presenter.onVerify(cameraId),
              onVerify: (capability) => void presenter.onVerifyCapability(cameraId, capability),
              onConfigure: (capability, protocol) =>
                presenter.onConfigure(cameraId, capability, protocol),
              onTogglePtz: () => presenter.onTogglePtz(camera),
              onSetPanInverted: (inverted) => void presenter.onSetPanInverted(cameraId, inverted),
              onRemove: (capability) => presenter.onRemove(cameraId, capability),
              onOpenManual: presenter.onOpenManual,
              onCloseManual: presenter.onCloseManual,
              onConfigureManually: (capability, protocol) =>
                void presenter.onConfigureManually(cameraId, capability, protocol),
            }}
          />

          <HelpPanel title="Une vérification échoue, que faire ?">
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
          </HelpPanel>

          <HelpPanel title="Quel flux faut-il faire analyser ?">
            <p>
              Sur une caméra large, jardin, garage, allée, où vous voulez seulement savoir que
              quelqu’un est passé, gardez le flux le plus léger en détection : c’est le réglage
              livré. Sur une caméra où vous voulez reconnaître les gens, entrée, couloir, salon,
              donnez la détection au flux le plus détaillé, surtout si les visages y apparaissent à
              plusieurs mètres.
            </p>
            <p>
              Si Vyzio devient lent et que les caméras saccadent, vérifiez qu’aucune n’analyse son
              flux le plus détaillé sans raison. Certaines caméras annoncent leurs flux sans en
              donner les dimensions : Vyzio affiche alors « Flux principal » ou « Flux secondaire »
              plutôt qu’un chiffre faux.
            </p>
          </HelpPanel>
        </SettingsSection>

        <div className="mt-8 border-t border-border pt-6">
          <Button type="button" variant="destructive" onClick={presenter.onAskDelete}>
            Supprimer cette caméra
          </Button>
        </div>

        <AdvancedFold lede="Comment Vyzio joint cette caméra.">
          <SettingsList settings={access} />

          <div className="mt-6 flex flex-col gap-3">
            <h3 className="font-medium">Protocoles</h3>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uido.searchingProtocols}
                  onClick={() => void presenter.onSearchProtocols(cameraId)}
                >
                  {uido.searchingProtocols ? 'Recherche…' : 'Rechercher les protocoles'}
                </Button>
                {/* Adding by hand is the way out when the search finds nothing (DESIGN SYSTEM § Capability cards). */}
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
          </div>

          <HelpPanel title="Un protocole ne répond pas, que vérifier ?">
            <p>
              Chaque protocole passe par son propre port, affiché dans sa case. « Répond » dit que
              la caméra écoute sur ce port et accepte le compte ; « Refuse l’accès » dit qu’elle
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
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={uido.saving}
        onSave={async () => {
          if (await presenter.onSave(camera, draft.values, draft.saved)) draft.accept()
        }}
        onDiscard={draft.discard}
      />

      {uido.confirmDelete && (
        <ConfirmModal
          title={`Supprimer « ${camera.displayName} » ?`}
          body="Vyzio cesse de surveiller cette caméra. Les enregistrements déjà faits ne sont pas effacés."
          confirmLabel="Supprimer"
          tone="danger"
          loading={uido.deleting}
          onConfirm={async () => {
            if (await presenter.onDelete(cameraId)) void navigate('/settings/cameras')
          }}
          onCancel={presenter.onCancelDelete}
        />
      )}
    </>
  )
}
