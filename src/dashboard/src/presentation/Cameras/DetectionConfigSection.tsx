import { Btn } from '../../common/components/Btn'
import { Select } from '../../common/components/Select'
import type {
  CameraRetention,
  CameraStream,
  MotionSensitivity,
} from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import { RetentionField } from '../../common/components/RetentionField'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_ORDER,
  type RetentionWindow,
} from '../../common/recording/retention'

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

// A stream is described by what the camera actually reported, never by an invented tier name.
// The rank is only a fallback for protocols that list their streams without measuring them.
function describeStream(stream: CameraStream, total: number): string {
  const parts: string[] = []

  if (stream.width !== null && stream.height !== null) {
    parts.push(`${stream.width} × ${stream.height}`)
  } else {
    parts.push(stream.ordinal === 0 ? 'Flux principal' : `Flux secondaire ${stream.ordinal}`)
  }

  if (stream.fps !== null) parts.push(`${stream.fps} img/s`)

  const suffix =
    stream.ordinal === 0
      ? ' — la plus détaillée'
      : stream.ordinal === total - 1
        ? ' — la plus légère'
        : ''

  return parts.join(' · ') + suffix
}

function explainStream(stream: CameraStream, total: number): string {
  if (stream.ordinal === 0 && total > 1) {
    return (
      'Les visages sont mieux reconnus et les images d’alerte sont nettes. ' +
      'En contrepartie, cette caméra occupe davantage le boîtier Vyzio.'
    )
  }
  return (
    'Vyzio réduit de toute façon l’image avant de l’analyser : une image plus légère ne lui retire ' +
    'quasiment rien et libère des ressources. En contrepartie, les visages éloignés risquent de ne ' +
    'plus être reconnus et les images d’alerte seront moins nettes.'
  )
}

interface DetectionConfigSectionProps {
  labels: string[]
  availableLabels: string[]
  allLabels: DetectionLabel[]
  loading: boolean
  retention: CameraRetention
  motionSensitivity: MotionSensitivity
  motionSensitivityPinned: boolean
  streams: CameraStream[]
  detectStreamId: string | null
  pendingChanges: boolean
  applyLoading: boolean
  onToggle: (value: string) => void
  onChangeRetention: (window: RetentionWindow, days: number | null) => void
  onChangeMotionSensitivity: (value: MotionSensitivity) => void
  onToggleMotionSensitivityPin: () => void
  onChangeDetectStream: (streamId: string | null) => void
  onApplyConfiguration: () => void
}

export function DetectionConfigSection({
  labels,
  availableLabels,
  allLabels,
  loading,
  retention,
  motionSensitivity,
  motionSensitivityPinned,
  streams,
  detectStreamId,
  pendingChanges,
  applyLoading,
  onToggle,
  onChangeRetention,
  onChangeMotionSensitivity,
  onToggleMotionSensitivityPin,
  onChangeDetectStream,
  onApplyConfiguration,
}: DetectionConfigSectionProps) {
  const displayLabels =
    availableLabels.length > 0
      ? allLabels.filter((l) => availableLabels.includes(l.value))
      : allLabels

  // A single stream leaves nothing to arbitrate — the choice only appears when the camera really
  // offers one (ADR-38).
  const selectedStream = streams.find((stream) => stream.id === detectStreamId)

  return (
    <section className="camera-detail-section">
      <h3 className="camera-detail-section-title">Détection</h3>
      {loading ? (
        <p className="camera-detail-section-loading">Chargement…</p>
      ) : (
        <>
          <div className="detection-group">
            <h4 className="detection-group-title">Ce que je surveille</h4>
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
          </div>

          <div className="detection-group">
            <h4 className="detection-group-title">Comment Vyzio analyse</h4>

            {streams.length > 1 && (
              <div className="detection-field">
                <label className="detection-field-label" htmlFor="detect-stream">
                  Image analysée
                </label>
                <Select
                  id="detect-stream"
                  size="sm"
                  value={detectStreamId ?? ''}
                  onChange={(e) => onChangeDetectStream(e.target.value || null)}
                >
                  {streams.map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {describeStream(stream, streams.length)}
                    </option>
                  ))}
                </Select>
                {selectedStream && (
                  <p className="detection-field-hint">
                    {explainStream(selectedStream, streams.length)}
                  </p>
                )}
                <p className="detection-field-hint">
                  Les enregistrements restent faits sur l’image la plus détaillée, quel que soit ce
                  choix.
                </p>
              </div>
            )}

            <div className="detection-field">
              <span className="detection-field-label">Sensibilité au mouvement</span>
              <label className="detection-check">
                <input
                  type="checkbox"
                  checked={!motionSensitivityPinned}
                  onChange={onToggleMotionSensitivityPin}
                />
                Régler automatiquement
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
                <p className="detection-field-value">
                  Actuellement : <strong>{SENSITIVITY_LABEL[motionSensitivity]}</strong>
                </p>
              )}

              <p className="detection-field-hint">
                {SENSITIVITY_EXPLANATION[motionSensitivity]}
                {!motionSensitivityPinned &&
                  ' Vyzio ajuste ce niveau selon l’agitation observée sur plusieurs heures.'}
              </p>
            </div>

            <div className="detection-field">
              <span className="detection-field-label">Ce qui est conservé</span>

              {RETENTION_ORDER.map((window) => (
                <RetentionField
                  key={window}
                  id={`retention-${window}`}
                  window={window}
                  days={retention[window].effective}
                  maxDays={retention.maxDays}
                  onCommit={(days) => onChangeRetention(window, days)}
                  inheritance={{
                    overridden: retention[window].override !== null,
                    installationDays: retention[window].installation,
                    onRevert: () => onChangeRetention(window, null),
                  }}
                />
              ))}

              {retention.continuous.effective > 0 && (
                <p className="detection-field-hint">{CONTINUOUS_DISK_WARNING}</p>
              )}
              <p className="detection-field-hint">
                Mettre 0 signifie que rien n’est conservé de cette nature. Si les trois valent 0,
                cette caméra n’enregistre plus rien.
              </p>
            </div>
          </div>

          {pendingChanges && (
            <div className="detection-pending" role="status">
              <p className="detection-pending-text">
                Ces réglages ne seront actifs qu’après un redémarrage du moteur de détection.
              </p>
              <Btn variant="primary" loading={applyLoading} onClick={onApplyConfiguration}>
                Appliquer maintenant
              </Btn>
            </div>
          )}
        </>
      )}
    </section>
  )
}
