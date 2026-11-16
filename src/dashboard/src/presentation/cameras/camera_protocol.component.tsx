import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { DiagnosticLine, ReadFailure } from '../../common/components/error_message'
import { DeleteAction } from '../../common/components/delete_action'
import { Loading } from '../../common/components/loading'
import { PageHeader } from '../../common/components/page_header'
import { SecondaryButton } from '../../common/components/secondary_button'
import { scrubSecrets } from '../../common/errors/scrub_secrets'
import { useGoBack } from '../../common/navigation/use_go_back'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsPage } from '../../common/settings/settings_page'
import type { Camera } from '../../domain/entities/camera.entity'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { ALL_PROTOCOLS, protocolKey } from './camera_connection_values'
import { connectionAdvancedPath } from './camera_paths'
import { CAPABILITY_LABELS, formatCheckedAt } from './cameras.formatters'
import { protocolFailureLine, protocolMark } from './capability_state'
import { CameraNotFound } from './components/camera_not_found'
import { protocolSettings, removalBlocker } from './components/protocol_settings'
import { PROTOCOL_LABELS } from './protocol_labels'
import { useCameraConnection } from './use_camera_connection'

/** One protocol of a camera: its state, its port and account, its own check, its removal last (CAM-17). */
export function CameraProtocolView() {
  const camera = useOutletContext<Camera>()
  const { protocol: slug } = useParams()
  const { cameras, hub } = useAppContainer()
  const goBack = useGoBack()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const { uido, presenter, draft, setProtocol } = useCameraConnection(camera, {
    container: cameras,
    hubContainer: hub,
  })
  const cameraId = camera.id
  const back = connectionAdvancedPath(cameraId)
  const protocol = ALL_PROTOCOLS.find((candidate) => candidate === slug)
  const entry = uido.protocols.find((candidate) => candidate.protocol === protocol)

  if (uido.cameraGone)
    return (
      <SettingsPage>
        <CameraNotFound within="tab" />
      </SettingsPage>
    )

  if (uido.protocolsLoading)
    return (
      <SettingsPage>
        <Loading />
      </SettingsPage>
    )

  if (uido.protocolsError)
    return (
      <SettingsPage>
        <ReadFailure
          error={uido.protocolsError}
          onRetry={() => presenter.onLoad(cameraId)}
          subject="Les protocoles de cette caméra n’ont pas pu être lus."
        />
      </SettingsPage>
    )

  if (protocol === undefined || entry === undefined)
    return (
      // No protocol to name: the page names its absence, and the way back.
      <SettingsPage>
        <PageHeader title="Protocole introuvable" />
        <Link to={back} className="inline-block underline underline-offset-2">
          Revenir à Avancé
        </Link>
      </SettingsPage>
    )

  const key = protocolKey(protocol)
  const label = PROTOCOL_LABELS[protocol]
  const failure = protocolFailureLine(entry.status)
  const usedBy = uido.bindings
    .filter((binding) => binding.isConfigured && binding.protocol === protocol)
    .map((binding) => CAPABILITY_LABELS[binding.capability])
  const edited = draft.values[key] !== draft.saved[key]
  const checking = uido.checking[protocol] === true

  return (
    <>
      <PageHeader title={label} mark={protocolMark(entry.status)} />
      <SettingsPage>
        {(failure || entry.checkedAt) && (
          <div className="mx-1 flex flex-col gap-1 text-body">
            {failure && <p className="text-destructive">{failure}</p>}
            {entry.lastError && <DiagnosticLine text={scrubSecrets(entry.lastError)} />}
            {entry.checkedAt && (
              <p className="text-muted-foreground">Vérifié le {formatCheckedAt(entry.checkedAt)}</p>
            )}
          </div>
        )}

        <SettingsList
          settings={protocolSettings(entry, draft.values[key], (patch) =>
            setProtocol(protocol, patch),
          )}
        />

        <div>
          <SecondaryButton
            icon={RefreshCw}
            type="button"
            disabled={checking}
            onClick={() => void presenter.onCheckProtocol(cameraId, protocol)}
          >
            {checking ? 'Vérification…' : 'Vérifier'}
          </SecondaryButton>
        </div>

        <DeleteAction
          label="Retirer ce protocole"
          question={`Retirer ${label} ?`}
          consequence="Vyzio oublie comment joindre la caméra par ce protocole, son port et son compte spécifique. Vous pourrez l’ajouter à nouveau."
          confirmLabel="Retirer"
          blocker={removalBlocker(usedBy, edited)}
          confirming={confirmRemove}
          deleting={uido.removing[protocol] === true}
          onAsk={() => setConfirmRemove(true)}
          onConfirm={async () => {
            if (await presenter.onRemoveProtocol(cameraId, protocol)) goBack(back)
            setConfirmRemove(false)
          }}
          onCancel={() => setConfirmRemove(false)}
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
