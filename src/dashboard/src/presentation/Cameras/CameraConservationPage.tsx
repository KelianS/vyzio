import { useParams } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { UnsavedChangesGuard } from '../../common/settings/UnsavedChangesGuard'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
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
import { SettingsPanel } from '../Settings/SettingsPanel'

type RetentionOverrides = Pick<
  DetectionConfigUpdate,
  'continuousDaysOverride' | 'motionDaysOverride' | 'eventClipDaysOverride'
>

const DRAFT_LABELS: Record<keyof RetentionOverrides, string> = {
  continuousDaysOverride: RETENTION_LABEL.continuous,
  motionDaysOverride: RETENTION_LABEL.motion,
  eventClipDaysOverride: RETENTION_LABEL.eventClip,
}

/**
 * Conservation **de cette camera** : la jumelle, un cran plus bas, de la page
 * Conservation de l'installation. Meme forme, meme contenu — seule change ce qui
 * declenche l'etat « suivi » : ici l'absence de surcharge, la-haut l'egalite
 * avec la valeur livree (ADR-39).
 */
export function CameraConservationPage() {
  const { cameraId } = useParams()
  const { cameras: container } = useAppContainer()
  const config = useAsync(() => container.getCameraDetectionConfig.execute(cameraId!), [cameraId])

  if (config.loading) return <SettingsPanel title="Conservation">Chargement…</SettingsPanel>
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

  const draft = useSettingsDraft<RetentionOverrides>({
    saved: {
      continuousDaysOverride: config.retention.continuous.override,
      motionDaysOverride: config.retention.motion.override,
      eventClipDaysOverride: config.retention.eventClip.override,
    },
    labels: DRAFT_LABELS,
  })

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
        reload()
      },
    },
  )

  const declarations: SettingDeclaration[] = RETENTION_ORDER.map((window) => {
    const field = RETENTION_UPDATE_FIELD[window]
    const override = draft.values[field]
    const inherited = config.retention[window].installation
    // La valeur qui s'applique : la surcharge si elle existe, sinon celle de
    // l'installation. `null` signifie « suivre », jamais une valeur deguisee.
    const effective = override ?? inherited

    return {
      id: `camera-retention-${window}`,
      label: RETENTION_LABEL[window],
      nature: { kind: 'number', unit: 'jours', min: 0, max: config.retention.maxDays },
      help: RETENTION_EXPLANATION[window],
      consequence: window === 'continuous' && effective > 0 ? CONTINUOUS_DISK_WARNING : undefined,
      value: effective,
      // Ecrire dans le champ suffit a creer la surcharge.
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
      <UnsavedChangesGuard when={draft.dirty} />

      <SettingsPanel
        title="Conservation"
        lede="Cette caméra suit les durées d’ensemble tant qu’elle n’en fixe pas une à elle. Chaque durée est indépendante."
      >
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
