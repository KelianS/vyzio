import type { FrigateStatus, SystemStats } from '../../domain/entities/SystemStats'

interface SystemMonitorPanelProps {
  stats: SystemStats
}

const STATUS_PILL_CLASS: Record<FrigateStatus, string> = {
  active: 'online',
  restarting: 'loading',
  unavailable: 'degraded',
}

const STATUS_LABEL: Record<FrigateStatus, string> = {
  active: 'Actif',
  restarting: 'Redémarrage…',
  unavailable: 'Indisponible',
}

function SystemStatusPill({ status }: { status: FrigateStatus }) {
  return <span className={`status-pill ${STATUS_PILL_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
}

type DegradedStatus = Exclude<FrigateStatus, 'active'>

const DEGRADED_MESSAGE: Record<DegradedStatus, string> = {
  restarting: 'Redémarrage en cours — les métriques réapparaîtront automatiquement.',
  unavailable: 'Système de détection inaccessible — métriques indisponibles.',
}

const DEGRADED_SHOW_DIAGNOSE_LINK: Record<DegradedStatus, boolean> = {
  restarting: false,
  unavailable: true,
}

function DegradedPanel({ status }: { status: DegradedStatus }) {
  return (
    <article className="panel hub-monitor-panel">
      <div className="hub-monitor-heading-row">
        <h2>Système</h2>
        <SystemStatusPill status={status} />
      </div>
      <p style={{ fontSize: '0.85rem', opacity: 0.6, padding: '0 0 8px' }}>
        {DEGRADED_MESSAGE[status]}
      </p>
      {DEGRADED_SHOW_DIAGNOSE_LINK[status] && (
        <div className="panel-cta-row">
          <a href="#expert" className="secondary-cta">
            Diagnostiquer →
          </a>
        </div>
      )}
    </article>
  )
}

export function SystemMonitorPanel({ stats }: SystemMonitorPanelProps) {
  switch (stats.status) {
    case 'restarting':
    case 'unavailable':
      return <DegradedPanel status={stats.status} />
    case 'active':
      break
    default: {
      const unreachable: never = stats.status
      return unreachable
    }
  }

  return (
    <article className="panel hub-monitor-panel">
      <div className="hub-monitor-heading-row">
        <h2>Système</h2>
        <SystemStatusPill status={stats.status} />
      </div>

      {stats.storage && (
        <div className="hub-monitor-section">
          <p className="hub-monitor-label">Stockage media</p>
          <div className="hub-monitor-bar-track">
            <div
              className="hub-monitor-bar-fill"
              style={{
                width:
                  stats.storage.totalGb > 0
                    ? `${Math.min(100, (stats.storage.usedGb / stats.storage.totalGb) * 100).toFixed(1)}%`
                    : '0%',
              }}
            />
          </div>
          <p className="hub-monitor-bar-legend">
            {stats.storage.usedGb} Go utilisés · {stats.storage.freeGb} Go libres ·{' '}
            {stats.storage.totalGb} Go total
          </p>
        </div>
      )}

      {stats.cameras.length > 0 && (
        <div className="hub-monitor-section">
          <p className="hub-monitor-label">FPS caméras</p>
          <div className="hub-monitor-camera-list">
            {stats.cameras.map(({ camera, fps }) => (
              <div key={camera} className="hub-monitor-camera-row">
                <span className="hub-monitor-camera-name">{camera}</span>
                <span className={`hub-monitor-fps${fps < 1 ? ' hub-monitor-fps--warn' : ''}`}>
                  {fps.toFixed(1)} fps
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel-cta-row">
        <a href="#expert" className="secondary-cta">
          Détails techniques →
        </a>
      </div>
    </article>
  )
}
