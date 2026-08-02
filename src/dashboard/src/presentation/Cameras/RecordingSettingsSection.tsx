import { RetentionField } from '../../common/components/RetentionField'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import type { RecordingSettingsUpdate } from '../../domain/entities/RecordingSettings'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_ORDER,
  type RetentionWindow,
} from '../../common/recording/retention'

const FIELD_OF: Record<RetentionWindow, keyof RecordingSettingsUpdate> = {
  continuous: 'continuousDays',
  motion: 'motionDays',
  eventClip: 'eventClipDays',
}

// Retention that every camera follows unless it overrides a duration of its own (ADR-39). An
// autonomous sub-section with its own local state, per the dashboard architecture rules.
export function RecordingSettingsSection() {
  const container = useAppContainer()
  const { toast } = useToast()
  const { data, loading, error, reload } = useAsync(
    () => container.cameras.getRecordingSettings.execute(),
    [],
  )

  // Saved on leaving a field rather than behind a button — the same way every other setting on
  // this screen behaves — so a half-typed number never reaches the server.
  const save = useAsyncAction(
    async (update: RecordingSettingsUpdate) =>
      container.cameras.saveRecordingSettings.execute(update),
    {
      onSuccess: () => {
        toast('Durée de conservation enregistrée.', 'success')
        reload()
      },
    },
  )

  if (loading) return <p className="camera-detail-section-loading">Chargement…</p>
  if (error || !data) return null

  const settings = data

  return (
    <section className="camera-detail-section">
      <h3 className="camera-detail-section-title">Ce que Vyzio conserve</h3>
      <p className="detection-field-hint">
        Ces durées s’appliquent à toutes vos caméras. Une caméra peut s’en écarter depuis sa propre
        fiche, durée par durée.
      </p>

      {RETENTION_ORDER.map((window) => (
        <RetentionField
          key={window}
          id={`general-retention-${window}`}
          window={window}
          days={settings[FIELD_OF[window]]}
          maxDays={settings.maxDays}
          onCommit={(days) =>
            save.run({
              continuousDays: settings.continuousDays,
              motionDays: settings.motionDays,
              eventClipDays: settings.eventClipDays,
              [FIELD_OF[window]]: days,
            })
          }
        />
      ))}

      {settings.continuousDays > 0 && (
        <p className="detection-field-hint">{CONTINUOUS_DISK_WARNING}</p>
      )}

      <p className="detection-field-hint">
        Mettre 0 signifie que rien n’est conservé de cette nature.
      </p>
    </section>
  )
}
