import { useEffect } from 'react'
import { useOutletContext } from 'react-router'
import { Search } from 'lucide-react'
import { useGoBack } from '../../common/navigation/use_go_back'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { DeleteAction } from '../../common/components/delete_action'
import type { Camera } from '../../domain/entities/camera.entity'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { HelpNotes, HelpQuestion } from '../../common/components/help_notes'
import { AdvancedFold } from '../../common/settings/advanced'
import { SecondaryButton } from '../../common/components/secondary_button'
import { CapabilitySection } from './components/capability_section'
import { CameraNotFound } from './components/camera_not_found'
import { AddProtocol } from './components/add_protocol_form'
import { ProtocolCard, ProtocolList } from './components/protocol_list'
import { CAPABILITY_LABELS } from './cameras.formatters'
import { protocolKey } from './camera_connection_values'
import { otherTestsSuspended, streamBindingOf } from './capability_state'
import { useCameraConnection } from './use_camera_connection'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'

export function CameraConnectionView() {
  const camera = useOutletContext<Camera>()
  const { cameras, hub } = useAppContainer()
  const goBack = useGoBack()
  const { uido, presenter, draft, setProtocol } = useCameraConnection(camera, {
    container: cameras,
    hubContainer: hub,
  })
  const cameraId = camera.id

  const neverDetected = camera.detectedAt === null
  const host = camera.host
  useEffect(() => {
    presenter.onArrive(cameraId, host, neverDetected)
  }, [presenter, cameraId, host, neverDetected])

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

  // How Vyzio reaches the camera itself: rare, in its Avancé fold (DESIGN SYSTEM § Folds).
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

        <AdvancedFold>
          <SettingsList settings={access} />

          <div className="flex flex-col gap-4">
            <ProtocolList
              loading={uido.protocolsLoading}
              readError={uido.protocolsError}
              onRetryRead={() => presenter.onLoad(cameraId)}
            >
              {uido.protocols.map((entry) => {
                const key = protocolKey(entry.protocol)
                return (
                  <ProtocolCard
                    key={entry.protocol}
                    entry={entry}
                    values={draft.values[key]}
                    onChange={(patch) => setProtocol(entry.protocol, patch)}
                    usedBy={uido.bindings
                      .filter((b) => b.isConfigured && b.protocol === entry.protocol)
                      .map((b) => CAPABILITY_LABELS[b.capability])}
                    edited={draft.values[key] !== draft.saved[key]}
                    checking={uido.checking[entry.protocol] === true}
                    removing={uido.removing[entry.protocol] === true}
                    onCheck={() => void presenter.onCheckProtocol(cameraId, entry.protocol)}
                    onRemove={() => presenter.onRemoveProtocol(cameraId, entry.protocol)}
                  />
                )
              })}
            </ProtocolList>
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
                {/* Adding by hand is the way out when the search finds nothing (CAM-64). */}
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

        <HelpNotes>
          <HelpQuestion title="Une vérification échoue">
            <p>
              Commencez par le flux vidéo : les autres capacités passent par lui. S’il échoue,
              corrigez l’adresse ou le compte de la caméra dans Avancé, ou la façon de lire les
              images dans les options du flux, enregistrez, puis relancez « Vérifier ».
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
          </HelpQuestion>

          <HelpQuestion title="Une capacité est à confirmer">
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
          </HelpQuestion>

          <HelpQuestion title="Quel rôle donner à chaque flux ?">
            <p>
              Par défaut, le flux le plus détaillé enregistre et le plus léger est analysé : Vyzio
              réduit de toute façon l’image avant de l’analyser.
            </p>
            <p>
              Sur une caméra large, jardin, garage, allée, gardez le flux le plus léger en
              détection. Pour reconnaître les gens, entrée, couloir, salon, donnez « Enregistrement
              et détection » au flux le plus détaillé, surtout si les visages y apparaissent à
              plusieurs mètres. Si Vyzio devient lent, vérifiez qu’aucune caméra n’analyse son flux
              le plus détaillé sans raison.
            </p>
            <p>
              Un seul flux enregistre. Donner un rôle à un flux le retire à celui qui l’avait. Un
              flux gardé sans servir a le rôle « Aucun ».
            </p>
            <p>
              Changer de protocole remplace les flux par ceux que la caméra sert par ce protocole. «
              Ajouter un flux » propose ceux qu’elle sert et qui ne sont pas dans la liste, y
              compris un flux retiré.
            </p>
            <p>
              Un chemin erroné se corrige en ajoutant le bon flux avec le rôle « Enregistrement »,
              puis en retirant l’ancien.
            </p>
            <p>
              Si la liste ne propose que « Autre chemin… », la caméra ne dit pas quels flux elle
              sert, ou ne répond pas : saisissez le chemin donné par le fabricant.
            </p>
            <p>
              Une caméra qui ne donne pas les dimensions de ses flux les voit nommés « Flux
              principal » ou « Flux secondaire » plutôt qu’avec un chiffre faux.
            </p>
          </HelpQuestion>

          <HelpQuestion title="Un protocole ne répond pas, que vérifier ?">
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
          </HelpQuestion>
        </HelpNotes>
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
