import { useEffect, useReducer } from 'react'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type {
  RecordingSettings,
  RecordingSettingsUpdate,
} from '../../domain/entities/recording_settings.entity'
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
import { buildConservationPresenter } from './conservation.presenter'
import { conservationReducer } from './conservation.reducer'
import { buildInitialConservationUido } from './conservation.uido'

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
export function ConservationView() {
  // Still wired through the "cameras" container, a holdover from where this section used to live.
  const { cameras: container, hub: hubContainer } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(conservationReducer, undefined, buildInitialConservationUido)
  const presenter = usePresenter(buildConservationPresenter, {
    container,
    hubContainer,
    dispatch,
    toast,
  })

  useEffect(() => {
    presenter.onLoad()
  }, [presenter])

  if (uido.loading) return <SettingsPage>Chargement…</SettingsPage>
  if (uido.error)
    return (
      <SettingsPage>
        <ReadFailure
          error={uido.error}
          onRetry={presenter.onLoad}
          subject="Les durées de conservation n’ont pas pu être lues."
        />
      </SettingsPage>
    )
  if (!uido.settings) return null

  return (
    <ConservationForm settings={uido.settings} saving={uido.saving} onSave={presenter.onSave} />
  )
}

function ConservationForm({
  settings,
  saving,
  onSave,
}: {
  settings: RecordingSettings
  saving: boolean
  onSave: (values: RecordingSettingsUpdate) => Promise<boolean>
}) {
  const draft = useSettingsDraft<RecordingSettingsUpdate>({
    saved: {
      continuousDays: settings.continuous.days,
      motionDays: settings.motion.days,
      eventClipDays: settings.eventClip.days,
    },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

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
        saving={saving}
        onSave={async () => {
          if (await onSave(draft.values)) draft.accept()
        }}
        onDiscard={draft.discard}
      />
    </>
  )
}
