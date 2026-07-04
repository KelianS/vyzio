import type { SystemStats } from '../../domain/entities/SystemStats'

interface SystemMonitorPanelProps {
  stats: SystemStats
}

export function SystemMonitorPanel({ stats }: SystemMonitorPanelProps) {
  if (!stats.available) {
    return (
      <article className="panel hub-monitor-panel">
        <div className="panel-heading">
          <h2>Système</h2>
        </div>
        <p style={{ fontSize: '0.85rem', opacity: 0.6, padding: '0 0 8px' }}>
          Système de détection inaccessible — métriques indisponibles.
        </p>
        <div className="panel-cta-row">
          <a href="#expert" className="secondary-cta">
            Diagnostiquer →
          </a>
        </div>
      </article>
    )
  }

  return (
    <article className="panel hub-monitor-panel">
      <div className="panel-heading">
        <h2>Système</h2>
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
