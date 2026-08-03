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
import type {
  RecordingSettings,
  RecordingSettingsUpdate,
} from '../../domain/entities/RecordingSettings'
import type { SaveRecordingSettings } from '../../domain/usecases/SaveRecordingSettings'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_EXPLANATION,
  RETENTION_LABEL,
  RETENTION_ORDER,
  formatDays,
  type RetentionWindow,
} from '../../common/recording/retention'
import { SettingsPage } from '../../common/settings/SettingsPage'

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
  if (error || !data) return null

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
      nature: { kind: 'number', unit: 'jours', min: 0, max: settings.maxDays },
      help: RETENTION_EXPLANATION[window],
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
        <p className="mt-4 text-sm text-muted-foreground">
          Mettre 0 signifie que rien n’est conservé de cette nature.
        </p>
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
