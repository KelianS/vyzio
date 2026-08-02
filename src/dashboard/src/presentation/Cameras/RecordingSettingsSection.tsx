import { RetentionField } from '../../common/components/RetentionField'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import type { RecordingSettingsUpdate } from '../../domain/entities/RecordingSettings'
import type { GetRecordingSettings } from '../../domain/usecases/GetRecordingSettings'
import type { SaveRecordingSettings } from '../../domain/usecases/SaveRecordingSettings'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_ORDER,
  type RetentionWindow,
} from '../../common/recording/retention'

// The save request stays flat while the read is grouped by window, so this bridges the two shapes.
const FIELD_OF: Record<RetentionWindow, keyof RecordingSettingsUpdate> = {
  continuous: 'continuousDays',
  motion: 'motionDays',
  eventClip: 'eventClipDays',
}

interface RecordingSettingsSectionProps {
  // Taken as props rather than pulled from the container, so the section can be rendered under
  // test without reaching the network.
  getRecordingSettings: GetRecordingSettings
  saveRecordingSettings: SaveRecordingSettings
}

// Retention that every camera follows unless it overrides a duration of its own (ADR-39). An
// autonomous sub-section with its own local state, per the dashboard architecture rules.
export function RecordingSettingsSection({
  getRecordingSettings,
  saveRecordingSettings,
}: RecordingSettingsSectionProps) {
  const { toast } = useToast()
  const { data, loading, error, reload } = useAsync(() => getRecordingSettings.execute(), [])

  // Saved on leaving a field rather than behind a button — the same way every other setting on
  // this screen behaves — so a half-typed number never reaches the server. The toast is the only
  // signal here, since the "configuration to apply" banner lives on a camera's own card.
  const save = useAsyncAction(
    async (update: RecordingSettingsUpdate) => saveRecordingSettings.execute(update),
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

  function commit(window: RetentionWindow, days: number) {
    save.run({
      continuousDays: settings.continuous.days,
      motionDays: settings.motion.days,
      eventClipDays: settings.eventClip.days,
      [FIELD_OF[window]]: days,
    })
  }

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
          days={settings[window].days}
          maxDays={settings.maxDays}
          onCommit={(days) => commit(window, days)}
          fallback={{
            // One level up from the camera: here the fallback is what Vyzio ships with, and there
            // is no override to key on — sitting on the value simply is following it.
            atFallback: settings[window].days === settings[window].default,
            days: settings[window].default,
            followingLabel: 'Valeur d’origine de Vyzio',
            revertLabel: 'Revenir à la valeur d’origine',
            onRevert: () => commit(window, settings[window].default),
          }}
        />
      ))}

      {settings.continuous.days > 0 && (
        <p className="detection-field-hint">{CONTINUOUS_DISK_WARNING}</p>
      )}

      <p className="detection-field-hint">
        Mettre 0 signifie que rien n’est conservé de cette nature.
      </p>
    </section>
  )
}
