import { Search } from 'lucide-react'
import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import type { Camera } from '../../domain/entities/camera.entity'
import { SettingsPage } from '../../common/settings/settings_page'
import { AdvancedPage } from '../../common/settings/advanced'
import { SecondaryButton } from '../../common/components/secondary_button'
import { AddProtocol } from './components/add_protocol_form'
import { ProtocolList } from './components/protocol_list'
import { CameraNotFound } from './components/camera_not_found'
import { useCameraConnection } from './use_camera_connection'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'

/** How Vyzio reaches a camera, its access and its protocols: the Avancé page of its Connexion (UI-09). */
export function CameraConnectionAdvancedView() {
  const camera = useOutletContext<Camera>()
  const { cameras, hub } = useAppContainer()
  const { uido, presenter, draft } = useCameraConnection(camera, {
    container: cameras,
    hubContainer: hub,
  })
  const cameraId = camera.id

  // How Vyzio reaches the camera itself: rare, in its Avancé page (DESIGN SYSTEM § Folds).
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
      nature: { kind: 'secret', placeholder: 'Inchangé', validating: uido.saving },
      help: 'Laissez vide pour conserver le mot de passe actuel.',
      value: draft.values.password,
      onChange: (value) => draft.set('password', value as string),
    },
  ]

  if (uido.cameraGone)
    return (
      <SettingsPage>
        <CameraNotFound within="tab" />
      </SettingsPage>
    )

  return (
    <>
      <AdvancedPage lede="Comment Vyzio joint cette caméra.">
        <SettingsList settings={access} />

        <div className="flex flex-col gap-4">
          <ProtocolList
            cameraId={cameraId}
            protocols={uido.protocols}
            loading={uido.protocolsLoading}
            readError={uido.protocolsError}
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
      </AdvancedPage>

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
