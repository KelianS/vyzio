import { Select } from '../../common/components/Select'
import type { MotionSensitivity } from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'

// Product wording only — the underlying Frigate setting is never named (principe produit #2).
const SENSITIVITY_LABEL: Record<MotionSensitivity, string> = {
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Réduite',
}

const SENSITIVITY_EXPLANATION: Record<MotionSensitivity, string> = {
  high: 'Cette caméra réagit au moindre mouvement.',
  medium: 'Les petits mouvements sont ignorés pour éviter les alertes inutiles.',
  low: 'Seuls les mouvements francs sont analysés — scène très animée.',
}

const SENSITIVITY_ORDER: MotionSensitivity[] = ['high', 'medium', 'low']

interface DetectionConfigSectionProps {
  labels: string[]
  availableLabels: string[]
  allLabels: DetectionLabel[]
  loading: boolean
  continuousRecordingEnabled: boolean
  motionSensitivity: MotionSensitivity
  motionSensitivityPinned: boolean
  onToggle: (value: string) => void
  onToggleContinuousRecording: () => void
  onChangeMotionSensitivity: (value: MotionSensitivity) => void
  onToggleMotionSensitivityPin: () => void
}

export function DetectionConfigSection({
  labels,
  availableLabels,
  allLabels,
  loading,
  continuousRecordingEnabled,
  motionSensitivity,
  motionSensitivityPinned,
  onToggle,
  onToggleContinuousRecording,
  onChangeMotionSensitivity,
  onToggleMotionSensitivityPin,
}: DetectionConfigSectionProps) {
  const displayLabels =
    availableLabels.length > 0
      ? allLabels.filter((l) => availableLabels.includes(l.value))
      : allLabels

  return (
    <section className="camera-detail-section">
      <h3 className="camera-detail-section-title">Détection — étiquettes actives</h3>
      {loading ? (
        <p className="camera-detail-section-loading">Chargement…</p>
      ) : (
        <>
          <div className="detection-label-grid">
            {displayLabels.map(({ value, displayName, emoji }) => (
              <label
                key={value}
                className={`detection-label-chip${labels.includes(value) ? ' detection-label-chip--active' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={labels.includes(value)}
                  onChange={() => onToggle(value)}
                />
                {emoji} {displayName}
              </label>
            ))}
          </div>
          {!labels.includes('person') && (
            <p className="detection-person-warning">
              Sans "Personne", la reconnaissance faciale ne fonctionnera pas sur cette caméra.
            </p>
          )}

          <div className="detection-continuous-block">
            <label className="detection-continuous-label">
              <input
                type="checkbox"
                checked={continuousRecordingEnabled}
                onChange={onToggleContinuousRecording}
              />
              Enregistrement continu
            </label>
            {continuousRecordingEnabled && (
              <p className="detection-continuous-warning">
                Attention : l'enregistrement continu consomme environ 1 a 3 Go par jour par camera.
              </p>
            )}
          </div>

          <div className="detection-sensitivity-block">
            <label className="detection-continuous-label">
              <input
                type="checkbox"
                checked={!motionSensitivityPinned}
                onChange={onToggleMotionSensitivityPin}
              />
              Régler la sensibilité automatiquement
            </label>

            {motionSensitivityPinned ? (
              <Select
                size="sm"
                value={motionSensitivity}
                onChange={(e) => onChangeMotionSensitivity(e.target.value as MotionSensitivity)}
                aria-label="Sensibilité de détection"
              >
                {SENSITIVITY_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {SENSITIVITY_LABEL[value]}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="detection-sensitivity-current">
                Sensibilité actuelle : <strong>{SENSITIVITY_LABEL[motionSensitivity]}</strong>
              </p>
            )}

            <p className="detection-sensitivity-explanation">
              {SENSITIVITY_EXPLANATION[motionSensitivity]}
              {!motionSensitivityPinned &&
                ' Vyzio ajuste ce niveau selon l’agitation observée sur plusieurs heures.'}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
