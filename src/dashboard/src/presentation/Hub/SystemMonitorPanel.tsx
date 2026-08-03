import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge, type BadgeTone } from '../../common/components/Badge'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import type {
  FrigateDetectorKind,
  FrigateStatus,
  SystemStats,
} from '../../domain/entities/SystemStats'

const STATUS_LABEL: Record<FrigateStatus, string> = {
  active: 'En marche',
  restarting: 'Redémarrage…',
  unavailable: 'Arrêtée',
}

const STATUS_TONE: Record<FrigateStatus, BadgeTone> = {
  active: 'ok',
  restarting: 'neutral',
  unavailable: 'danger',
}

const DETECTOR_HARDWARE_LABEL: Record<FrigateDetectorKind, string> = {
  edge_tpu: 'Accélérateur dédié',
  openvino: 'Carte graphique',
  cpu: 'Processeur',
}

type DegradedStatus = Exclude<FrigateStatus, 'active'>

const DEGRADED_MESSAGE: Record<DegradedStatus, string> = {
  restarting: 'Les mesures réapparaîtront d’elles-mêmes.',
  unavailable: 'Aucune mesure tant que la surveillance ne tourne pas.',
}

/** Diagnosis link only makes sense when the state won't resolve on its own. */
const DEGRADED_SHOWS_DIAGNOSIS: Record<DegradedStatus, boolean> = {
  restarting: false,
  unavailable: true,
}

const ADVANCED_PATH = '/settings/systeme/avance'

export function SystemMonitorPanel({ stats }: { stats: SystemStats }) {
  switch (stats.status) {
    case 'restarting':
    case 'unavailable':
      return (
        <Panel status={stats.status}>
          <p className="mt-3 text-sm text-muted-foreground">{DEGRADED_MESSAGE[stats.status]}</p>
          {DEGRADED_SHOWS_DIAGNOSIS[stats.status] && (
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link to={ADVANCED_PATH}>Diagnostiquer</Link>
              </Button>
            </div>
          )}
        </Panel>
      )
    case 'active':
      break
    default: {
      const unreachable: never = stats.status
      return unreachable
    }
  }

  const usedRatio =
    stats.storage && stats.storage.totalGb > 0 ? stats.storage.usedGb / stats.storage.totalGb : 0

  return (
    <Panel status={stats.status}>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Analyse des images</dt>
          <dd>
            {DETECTOR_HARDWARE_LABEL[stats.detection.hardware]} · {stats.detection.targetFps} images
            par seconde
          </dd>
        </div>

        {stats.storage && (
          <div>
            <dt className="text-muted-foreground">Espace disque</dt>
            <dd>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    usedRatio > 0.9 ? 'bg-destructive' : 'bg-primary',
                  )}
                  style={{ width: `${Math.min(100, usedRatio * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="mt-1 block">
                {stats.storage.freeGb} Go libres sur {stats.storage.totalGb} Go
              </span>
            </dd>
          </div>
        )}

        {stats.cameras.length > 0 && (
          <div>
            <dt className="text-muted-foreground">Images reçues</dt>
            <dd className="mt-1 space-y-0.5">
              {stats.cameras.map(({ camera, fps }) => (
                <span key={camera} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{camera.replaceAll('_', ' ')}</span>
                  {/* Sous une image par seconde, la camera ne suit plus. */}
                  <span className={cn('tabular-nums', fps < 1 && 'text-destructive')}>
                    {fps.toFixed(1)}/s
                  </span>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4">
        <Button asChild variant="ghost" size="sm">
          <Link to={ADVANCED_PATH}>Détails techniques</Link>
        </Button>
      </div>
    </Panel>
  )
}

function Panel({ status, children }: { status: FrigateStatus; children: ReactNode }) {
  return (
    <section className="rounded-card bg-card p-5 text-card-foreground shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Surveillance</h2>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      {children}
    </section>
  )
}
