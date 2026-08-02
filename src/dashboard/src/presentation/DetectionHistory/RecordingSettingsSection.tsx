import { useState } from 'react'
import { Btn } from '../../common/components/Btn'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import type { RecordingSettingsUpdate } from '../../domain/entities/RecordingSettings'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_EXPLANATION,
  RETENTION_LABEL,
  RETENTION_ORDER,
  type RetentionWindow,
} from '../../common/recording/retention'

const FIELD_OF: Record<RetentionWindow, keyof RecordingSettingsUpdate> = {
  continuous: 'continuousDays',
  motion: 'motionDays',
  eventClip: 'eventClipDays',
}

// Installation-wide retention (ADR-39) — the values every camera follows unless it says otherwise.
// An autonomous sub-section with its own local state, per the dashboard architecture rules.
export function RecordingSettingsSection() {
  const container = useAppContainer()
  const { toast } = useToast()
  const { data, loading, error, reload } = useAsync(
    () => container.detectionHistory.getRecordingSettings.execute(),
    [],
  )

  // The server stays the source of truth; edits are an overlay on top of it rather than a copy
  // kept in sync by an effect. Clearing the overlay is what "saved" means.
  const [edits, setEdits] = useState<Partial<RecordingSettingsUpdate>>({})

  const save = useAsyncAction(
    async (update: RecordingSettingsUpdate) =>
      container.detectionHistory.saveRecordingSettings.execute(update),
    {
      onSuccess: () => {
        setEdits({})
        toast('Durées de conservation enregistrées.', 'success')
        reload()
      },
    },
  )

  if (loading) return <p className="camera-detail-section-loading">Chargement…</p>
  if (error || !data) return null

  const draft: RecordingSettingsUpdate = {
    continuousDays: edits.continuousDays ?? data.continuousDays,
    motionDays: edits.motionDays ?? data.motionDays,
    eventClipDays: edits.eventClipDays ?? data.eventClipDays,
  }

  const dirty = RETENTION_ORDER.some((window) => draft[FIELD_OF[window]] !== data[FIELD_OF[window]])

  return (
    <section className="camera-detail-section">
      <h3 className="camera-detail-section-title">Ce que Vyzio conserve</h3>
      <p className="detection-field-hint">
        Ces durées s’appliquent à toutes vos caméras. Une caméra peut s’en écarter depuis sa propre
        fiche.
      </p>

      {RETENTION_ORDER.map((window) => (
        <div key={window} className="retention-row">
          <label className="retention-row-label" htmlFor={`installation-retention-${window}`}>
            {RETENTION_LABEL[window]}
          </label>
          <input
            id={`installation-retention-${window}`}
            className="retention-row-input"
            type="number"
            min={0}
            max={data.maxDays}
            value={draft[FIELD_OF[window]]}
            onChange={(e) =>
              setEdits({
                ...edits,
                [FIELD_OF[window]]: Number.parseInt(e.target.value, 10) || 0,
              })
            }
          />
          <span className="retention-row-unit">jours</span>
          <p className="detection-field-hint">{RETENTION_EXPLANATION[window]}</p>
        </div>
      ))}

      {draft.continuousDays > 0 && <p className="detection-field-hint">{CONTINUOUS_DISK_WARNING}</p>}

      <p className="detection-field-hint">
        Mettre 0 signifie que rien n’est conservé de cette nature.
      </p>

      <Btn
        variant="primary"
        disabled={!dirty}
        loading={save.loading}
        onClick={() => save.run(draft)}
      >
        Enregistrer
      </Btn>
    </section>
  )
}
