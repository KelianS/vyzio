import { useEffect, useReducer } from 'react'
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
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { CapabilitySection } from './components/capability_section'
import {
  buildCameraConnectionPresenter,
  type ConnectionValues,
} from './camera_connection.presenter'
import { cameraConnectionReducer } from './camera_connection.reducer'
import { buildInitialCameraConnectionUido } from './camera_connection.uido'

const DRAFT_LABELS: Record<keyof ConnectionValues, string> = {
  displayName: 'Nom',
  host: 'Adresse',
  port: 'Port',
  streamPath: 'Chemin du flux',
  username: 'Identifiant',
  password: 'Mot de passe',
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

  const draft = useSettingsDraft<ConnectionValues>({
    saved: {
      displayName: camera.displayName,
      host: camera.host,
      port: camera.port,
      streamPath: camera.streamPath ?? '',
      username: camera.username ?? '',
      password: '',
    },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const declarations: SettingDeclaration[] = [
    {
      id: 'connection-name',
      label: 'Nom',
      nature: { kind: 'text' },
      value: draft.values.displayName,
      onChange: (value) => draft.set('displayName', value as string),
    },
    {
      id: 'connection-host',
      label: 'Adresse',
      nature: { kind: 'text', placeholder: '192.168.1.50' },
      help: 'L’adresse de la caméra sur votre réseau local. Elle peut changer si votre box la réattribue.',
      value: draft.values.host,
      onChange: (value) => draft.set('host', value as string),
    },
    {
      id: 'connection-port',
      label: 'Port',
      nature: { kind: 'number', min: 1, max: 65535 },
      value: draft.values.port,
      onChange: (value) => draft.set('port', value as number),
    },
  ]

  // DVRIP derives the stream path from the protocol; asking for it makes no sense.
  if (camera.streamProtocol !== 'dvrip') {
    declarations.push({
      id: 'connection-stream-path',
      label: 'Chemin du flux',
      nature: { kind: 'text', placeholder: '/stream1' },
      help: 'Vyzio le demande à la caméra quand elle sait répondre. Ne le renseignez que si la caméra n’a pas été reconnue.',
      value: draft.values.streamPath,
      onChange: (value) => draft.set('streamPath', value as string),
    })
  }

  declarations.push(
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
  )

  return (
    <>
      <SettingsPage lede="Comment Vyzio joint cette caméra.">
        <SettingsList settings={declarations} />

        {/* Verifying and deleting act at once: they have no place in the draft. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={uido.verifying}
            onClick={() => void presenter.onVerify(cameraId)}
          >
            {uido.verifying ? 'Vérification…' : 'Vérifier la connexion'}
          </Button>
          <Button type="button" variant="destructive" onClick={presenter.onAskDelete}>
            Supprimer cette caméra
          </Button>
        </div>

        {/* Configuring a capability tests a connection and returns a result: an action, not a draft value. */}
        <SettingsSection title="Capacités" lede="Ce que Vyzio a vérifié auprès de cette caméra.">
          <CapabilitySection
            camera={camera}
            bindings={uido.bindings}
            loading={uido.bindingsLoading}
            detecting={uido.detecting}
            pending={uido.pending}
            manualFormOpen={uido.manualFormOpen}
            manualConfiguring={uido.manualConfiguring}
            intents={{
              onDetect: () => void presenter.onDetect(cameraId),
              onConfigure: (capability, protocol, configJson) =>
                presenter.onConfigure(cameraId, capability, protocol, configJson),
              onTogglePtz: () => presenter.onTogglePtz(camera),
              onSetPanInverted: (inverted) => void presenter.onSetPanInverted(cameraId, inverted),
              onRemove: (capability) => presenter.onRemove(cameraId, capability),
              onOpenManual: presenter.onOpenManual,
              onCloseManual: presenter.onCloseManual,
              onConfigureManually: (capability, protocol) =>
                void presenter.onConfigureManually(cameraId, capability, protocol),
            }}
          />

          <HelpPanel title="Le test échoue, que vérifier ?">
            <p>
              Que la caméra est joignable sur le réseau, et que le port du protocole choisi est
              ouvert — <em>8899</em> pour ONVIF, <em>34567</em> pour DVRIP. Les identifiants sont
              ceux saisis à l’ajout de la caméra : s’ils ont changé sur la caméra, corrigez-les
              d’abord ci-dessus.
            </p>
            <p>
              Beaucoup de caméras parlent plusieurs protocoles — une ICSee répond souvent en DVRIP
              et en ONVIF. Si l’un échoue, essayez l’autre : une capacité dont le test échoue n’est
              jamais proposée comme active, et le test se relance à tout moment.
            </p>
            <p>
              Deux limites connues : sur les firmwares d’entrée de gamme, ONVIF répond parfois en
              plusieurs secondes, ce qui rend le pilotage précis difficile ; et l’orientation à
              l’écart, en vie privée, suppose que le PTZ soit déjà vérifié sur la même caméra.
            </p>
          </HelpPanel>
        </SettingsSection>
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={uido.saving}
        onSave={async () => {
          if (await presenter.onSave(camera, draft.values)) draft.accept()
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
