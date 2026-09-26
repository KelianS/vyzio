import { useEffect, useReducer } from 'react'
import { useParams } from 'react-router'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_LABEL,
  RETENTION_ORDER,
  RETENTION_UPDATE_FIELD,
  formatDays,
  retentionHelp,
  retentionMinDays,
} from '../../common/recording/retention'
import { SettingsPage } from '../../common/settings/settings_page'
import { RetentionHelp } from '../../common/recording/retention_help'
import { ReadFailure } from '../../common/components/error_message'
import {
  buildCameraConservationPresenter,
  type RetentionOverrides,
} from './camera_conservation.presenter'
import { cameraConservationReducer } from './camera_conservation.reducer'
import { buildInitialCameraConservationUido } from './camera_conservation.uido'

const DRAFT_LABELS: Record<keyof RetentionOverrides, string> = {
  continuousDaysOverride: RETENTION_LABEL.continuous,
  motionDaysOverride: RETENTION_LABEL.motion,
  eventClipDaysOverride: RETENTION_LABEL.eventClip,
}

/** Per-camera retention: same shape as the installation page, "following" means no override here (ADR-39). */
export function CameraConservationView() {
  const { cameraId } = useParams()
  const { cameras: container, hub: hubContainer } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    cameraConservationReducer,
    undefined,
    buildInitialCameraConservationUido,
  )
  const presenter = usePresenter(buildCameraConservationPresenter, {
    container,
    hubContainer,
    dispatch,
    toast,
  })

  useEffect(() => {
    presenter.onLoad(cameraId!)
  }, [presenter, cameraId])

  if (uido.loading) return <SettingsPage>Chargement…</SettingsPage>
  if (uido.error)
    return (
      <SettingsPage>
        <ReadFailure error={uido.error} onRetry={() => presenter.onLoad(cameraId!)} />
      </SettingsPage>
    )
  if (!uido.config) return null
  const config = uido.config

  return (
    <ConservationForm
      config={config}
      saving={uido.saving}
      onSave={(values) => presenter.onSave(cameraId!, config, values)}
    />
  )
}

function ConservationForm({
  config,
  saving,
  onSave,
}: {
  config: DetectionConfig
  saving: boolean
  onSave: (values: RetentionOverrides) => Promise<boolean>
}) {
  const draft = useSettingsDraft<RetentionOverrides>({
    saved: {
      continuousDaysOverride: config.retention.continuous.override,
      motionDaysOverride: config.retention.motion.override,
      eventClipDaysOverride: config.retention.eventClip.override,
    },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const declarations: SettingDeclaration[] = RETENTION_ORDER.map((window) => {
    const field = RETENTION_UPDATE_FIELD[window]
    const override = draft.values[field]
    const inherited = config.retention[window].installation
    // Override if set, otherwise the installation value; `null` means "follow", never a disguised value.
    const effective = override ?? inherited

    return {
      id: `camera-retention-${window}`,
      label: RETENTION_LABEL[window],
      nature: {
        kind: 'number',
        unit: 'jours',
        min: retentionMinDays(window, config.retention.minEventClipDays),
        max: config.retention.maxDays,
      },
      help: retentionHelp(window),
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

        <RetentionHelp />
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving}
        onSave={async () => {
          if (await onSave(draft.values)) draft.accept()
        }}
        onDiscard={draft.discard}
      />
    </>
  )
}
