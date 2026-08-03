import { useParams } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { useUnsavedChanges } from '../Navigation/useUnsavedChanges'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useSurveillanceRefresh } from '../Surveillance/useSurveillanceRefresh'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { DetectionConfig, DetectionConfigUpdate } from '../../domain/entities/DetectionConfig'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_EXPLANATION,
  RETENTION_LABEL,
  RETENTION_ORDER,
  RETENTION_UPDATE_FIELD,
  formatDays,
} from '../../common/recording/retention'
import { SettingsPage } from '../../common/settings/SettingsPage'

type RetentionOverrides = Pick<
  DetectionConfigUpdate,
  'continuousDaysOverride' | 'motionDaysOverride' | 'eventClipDaysOverride'
>

const DRAFT_LABELS: Record<keyof RetentionOverrides, string> = {
  continuousDaysOverride: RETENTION_LABEL.continuous,
  motionDaysOverride: RETENTION_LABEL.motion,
  eventClipDaysOverride: RETENTION_LABEL.eventClip,
}

/** Per-camera retention: same shape as the installation page, "following" means no override here (ADR-39). */
export function CameraConservationPage() {
  const { cameraId } = useParams()
  const { cameras: container } = useAppContainer()
  const config = useAsync(() => container.getCameraDetectionConfig.execute(cameraId!), [cameraId])

  if (config.loading) return <SettingsPage>Chargement…</SettingsPage>
  if (!config.data) return null

  return <ConservationForm cameraId={cameraId!} config={config.data} reload={config.reload} />
}

function ConservationForm({
  cameraId,
  config,
  reload,
}: {
  cameraId: string
  config: DetectionConfig
  reload: () => void
}) {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const refreshSurveillance = useSurveillanceRefresh()

  const draft = useSettingsDraft<RetentionOverrides>({
    saved: {
      continuousDaysOverride: config.retention.continuous.override,
      motionDaysOverride: config.retention.motion.override,
      eventClipDaysOverride: config.retention.eventClip.override,
    },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(
    async () =>
      container.saveCameraDetectionConfig.execute(cameraId, {
        labels: config.labels,
        motionSensitivity: config.motionSensitivity,
        motionSensitivityPinned: config.motionSensitivityPinned,
        detectStreamId: config.detectStreamId,
        ...draft.values,
      }),
    {
      onSuccess: () => {
        draft.accept()
        toast('Durées de conservation enregistrées.', 'success')
        refreshSurveillance()
        reload()
      },
    },
  )

  const declarations: SettingDeclaration[] = RETENTION_ORDER.map((window) => {
    const field = RETENTION_UPDATE_FIELD[window]
    const override = draft.values[field]
    const inherited = config.retention[window].installation
    // Override if set, otherwise the installation value; `null` means "follow", never a disguised value.
    const effective = override ?? inherited

    return {
      id: `camera-retention-${window}`,
      label: RETENTION_LABEL[window],
      nature: { kind: 'number', unit: 'jours', min: 0, max: config.retention.maxDays },
      help: RETENTION_EXPLANATION[window],
      consequence: window === 'continuous' && effective > 0 ? CONTINUOUS_DISK_WARNING : undefined,
      value: effective,
      // Writing to the field is what creates the override.
      onChange: (days) => draft.set(field, days as number),
      provenance: {
        following: override === null,
        fallbackLabel: formatDays(inherited),
        revertLabel: 'Suivre le réglage d’ensemble',
        onRevert: () => draft.set(field, null),
      },
    }
  })

  return (
    <>
      <SettingsPage lede="Cette caméra suit les durées d’ensemble tant qu’elle n’en fixe pas une à elle. Chaque durée est indépendante.">
        <SettingsList settings={declarations} />
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />
    </>
  )
}
