import type { DetectionLabel } from '../../domain/entities/DetectionLabel'

interface DetectionConfigSectionProps {
  labels: string[]
  availableLabels: string[]
  allLabels: DetectionLabel[]
  loading: boolean
  continuousRecordingEnabled: boolean
  onToggle: (value: string) => void
  onToggleContinuousRecording: () => void
}

export function DetectionConfigSection({
  labels,
  availableLabels,
  allLabels,
  loading,
  continuousRecordingEnabled,
  onToggle,
  onToggleContinuousRecording,
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
        </>
      )}
    </section>
  )
}
