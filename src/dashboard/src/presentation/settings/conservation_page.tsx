import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useAsync } from '../../common/hooks/use_async'
import { useAsyncAction } from '../../common/hooks/use_async_action'
import { useToast } from '../../common/components/toast'
import { useSurveillanceRefresh } from '../surveillance/use_surveillance_refresh'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type {
  RecordingSettings,
  RecordingSettingsUpdate,
} from '../../domain/entities/recording_settings.entity'
import type { SaveRecordingSettings } from '../../domain/usecases/save_recording_settings.use_case'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_LABEL,
  RETENTION_ORDER,
  formatDays,
  retentionHelp,
  retentionMinDays,
  type RetentionWindow,
} from '../../common/recording/retention'
import { SettingsPage } from '../../common/settings/settings_page'
import { RetentionHelp } from '../../common/recording/retention_help'
import { ReadFailure } from '../../common/components/error_message'

// The save request is flat while reads are grouped by window; this bridges the two shapes.
const FIELD_OF = {
  continuous: 'continuousDays',
  motion: 'motionDays',
  eventClip: 'eventClipDays',
} as const satisfies Record<RetentionWindow, keyof RecordingSettingsUpdate>

const DRAFT_LABELS: Record<keyof RecordingSettingsUpdate, string> = {
  continuousDays: RETENTION_LABEL.continuous,
  motionDays: RETENTION_LABEL.motion,
  eventClipDays: RETENTION_LABEL.eventClip,
}

/** Installation-wide retention (ADR-39), in the settings grammar (ADR-43) and draft cycle (ADR-41). */
export function ConservationPage() {
  // Still wired through the "cameras" container, a holdover from where this section used to live.
  const { cameras: container } = useAppContainer()
  const { data, loading, error, reload } = useAsync(
    () => container.getRecordingSettings.execute(),
    [],
  )

  if (loading) return <SettingsPage>Chargement…</SettingsPage>
  if (error)
    return (
      <SettingsPage>
        <ReadFailure error={error} onRetry={reload} />
      </SettingsPage>
    )
  if (!data) return null

  return <ConservationForm settings={data} reload={reload} save={container.saveRecordingSettings} />
}

function ConservationForm({
  settings,
  reload,
  save,
}: {
  settings: RecordingSettings
  reload: () => void
  save: SaveRecordingSettings
}) {
  const { toast } = useToast()
  const refreshSurveillance = useSurveillanceRefresh()

  const draft = useSettingsDraft<RecordingSettingsUpdate>({
    saved: {
      continuousDays: settings.continuous.days,
      motionDays: settings.motion.days,
      eventClipDays: settings.eventClip.days,
    },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(async () => save.execute(draft.values), {
    onSuccess: () => {
      draft.accept()
      toast('Durées de conservation enregistrées.', 'success')
      refreshSurveillance()
      reload()
    },
  })

  const declarations: SettingDeclaration[] = RETENTION_ORDER.map((window) => {
    const field = FIELD_OF[window]
    const current = draft.values[field]
    const shipped = settings[window].default

    return {
      id: `retention-${window}`,
      label: RETENTION_LABEL[window],
      nature: {
        kind: 'number',
        unit: 'jours',
        min: retentionMinDays(window, settings.minEventClipDays),
        max: settings.maxDays,
      },
      help: retentionHelp(window),
      // A cost stays visible without an extra gesture (ADR-43).
      consequence: window === 'continuous' && current > 0 ? CONTINUOUS_DISK_WARNING : undefined,
      value: current,
      onChange: (days) => draft.set(field, days as number),
      provenance: {
        // One level above a camera: there's no override to fall back to, so matching the shipped value *is* following it.
        following: current === shipped,
        fallbackLabel: formatDays(shipped),
        revertLabel: 'Revenir à la valeur d’origine',
        onRevert: () => draft.set(field, shipped),
      },
    }
  })

  return (
    <>
      <SettingsPage lede="Ces durées s’appliquent à toutes vos caméras. Une caméra peut s’en écarter depuis sa propre fiche, durée par durée.">
        <SettingsList settings={declarations} />

        <RetentionHelp />
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
