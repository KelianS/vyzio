import { useParams } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { UnsavedChangesGuard } from '../../common/settings/UnsavedChangesGuard'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { DetectionConfig } from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import { SettingsPanel } from '../Settings/SettingsPanel'
import {
  DETECTION_DRAFT_LABELS,
  buildDetectionSettings,
  type DetectionUpdate,
} from './cameraDetectionSettings'

export function CameraDetectionPage() {
  const { cameraId } = useParams()
  const { cameras: container } = useAppContainer()

  const config = useAsync(() => container.getCameraDetectionConfig.execute(cameraId!), [cameraId])
  const labels = useAsync(() => container.getCameraLabels.execute(), [])

  if (config.loading || labels.loading) {
    return <SettingsPanel title="Détection">Chargement…</SettingsPanel>
  }
  if (!config.data || !labels.data) return null

  return (
    <DetectionForm
      cameraId={cameraId!}
      config={config.data}
      allLabels={labels.data}
      reload={config.reload}
    />
  )
}

function DetectionForm({
  cameraId,
  config,
  allLabels,
  reload,
}: {
  cameraId: string
  config: DetectionConfig
  allLabels: DetectionLabel[]
  reload: () => void
}) {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()

  const draft = useSettingsDraft<DetectionUpdate>({
    saved: {
      labels: config.labels,
      motionSensitivity: config.motionSensitivity,
      motionSensitivityPinned: config.motionSensitivityPinned,
      detectStreamId: config.detectStreamId,
    },
    labels: DETECTION_DRAFT_LABELS,
  })

  const saving = useAsyncAction(
    async () =>
      container.saveCameraDetectionConfig.execute(cameraId, {
        ...draft.values,
        // Inchangees ici : elles se reglent sur la page Conservation.
        continuousDaysOverride: config.retention.continuous.override,
        motionDaysOverride: config.retention.motion.override,
        eventClipDaysOverride: config.retention.eventClip.override,
      }),
    {
      onSuccess: () => {
        draft.accept()
        toast('Réglages de détection enregistrés.', 'success')
        reload()
      },
    },
  )

  const declarations = buildDetectionSettings({
    config,
    allLabels,
    values: draft.values,
    set: draft.set,
  })

  return (
    <>
      <UnsavedChangesGuard when={draft.dirty} />

      <SettingsPanel title="Détection" lede="Ce que cette caméra cherche, et avec quelle image.">
        <SettingsList settings={declarations} />
      </SettingsPanel>

      <SettingsDraftBar
        changes={draft.changes}
        interruptsMonitoring
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />
    </>
  )
}
