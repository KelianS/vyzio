import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge, type BadgeTone } from '../../common/components/badge'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { TechnicalDetails } from '../../common/components/technical_details'
import type { Camera } from '../../domain/entities/camera.entity'
import type {
  FrigateDetectorKind,
  FrigateStatus,
  SystemStats,
} from '../../domain/entities/system_stats.entity'

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

export function SystemMonitorPanel({ stats, cameras }: { stats: SystemStats; cameras: Camera[] }) {
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
  const frameRates = receivedFrameRates(stats, cameras)

  return (
    <Panel status={stats.status}>
      {stats.storage && (
        <dl className="mt-3 text-sm">
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
        </dl>
      )}

      <TechnicalDetails>
        <dl className="space-y-3">
          <div>
            <dt className="text-muted-foreground">Analyse des images</dt>
            <dd>
              {DETECTOR_HARDWARE_LABEL[stats.detection.hardware]} · {stats.detection.targetFps}{' '}
              images par seconde
            </dd>
          </div>

          {frameRates.length > 0 && (
            <div>
              <dt className="text-muted-foreground">Images reçues par seconde</dt>
              <dd className="mt-1 space-y-0.5">
                {frameRates.map(({ key, label, fps }) => (
                  <span key={key} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{label}</span>
                    <span className="tabular-nums">{FPS_FORMAT.format(fps)}</span>
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </TechnicalDetails>

      <div className="mt-4">
        <Button asChild variant="ghost" size="sm">
          <Link to={ADVANCED_PATH}>Ouvrir l’interface technique</Link>
        </Button>
      </div>
    </Panel>
  )
}

const FPS_FORMAT = new Intl.NumberFormat('fr', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Rates come keyed by the engine's camera name; the user knows the name they gave (principle 2). */
function receivedFrameRates(stats: SystemStats, cameras: Camera[]) {
  const byEngineKey = new Map(cameras.map((camera) => [camera.frigateCameraName, camera]))
  return stats.cameras.map(({ camera: engineKey, fps }) => ({
    key: engineKey,
    label: byEngineKey.get(engineKey)?.displayName ?? 'Caméra retirée ou renommée',
    fps,
  }))
}

function Panel({ status, children }: { status: FrigateStatus; children: ReactNode }) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-card bg-card p-5 text-card-foreground shadow-[var(--shadow-soft)] sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="font-serif text-2xl">
          Surveillance
        </h2>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      {children}
    </section>
  )
}
