import { SurveillanceEntry, surveillanceEntryOf } from '../../common/camera/camera_status'
import { privacyMissNotice } from '../../common/privacy/privacy_status'
import { isStorageCritical } from '../../common/surveillance/storage'
import { CameraState, type Camera } from '../../domain/entities/camera.entity'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { liveViewPath } from '../live_view/live_view.route'

/** One line the bar grows for (UI-30): what happens, and how its second line says since when. */
export interface BarAlert {
  /** Stable while the cause lasts: the bar remembers since when by it. */
  readonly key: string
  readonly title: string
  /** Leads the elapsed time on the second line (« Hors ligne depuis » 4 min). */
  readonly since?: string
  /** A second line that says more than a time. */
  readonly detail?: string
  readonly to?: string
  /** False for an alert that cannot be set aside: nothing works while it lasts (UI-30). */
  readonly dismissible: boolean
}

interface BarAlertFacts {
  readonly cameras: readonly Camera[]
  readonly systemStats: SystemStats | null
  readonly hubLost: boolean
  readonly restartFailed: boolean
  /** Cameras the user is cutting or resuming right now: their act tells its own miss. */
  readonly privacyActing: readonly string[]
  /** Misses a toast already told this session. */
  readonly privacyMissesTold: readonly string[]
}

/** What the bar carries, from the state every screen already reads (UI-30). */
export function barAlerts({
  cameras,
  systemStats,
  hubLost,
  restartFailed,
  privacyActing,
  privacyMissesTold,
}: BarAlertFacts): BarAlert[] {
  // Out of reach, every other fact is stale: only the loss is certain.
  if (hubLost)
    return [
      {
        key: 'hub-lost',
        title: 'Vyzio ne répond plus',
        since: 'Injoignable depuis',
        dismissible: false,
      },
    ]

  const alerts: BarAlert[] = cameras
    .filter(
      (camera) =>
        camera.status === CameraState.Offline &&
        surveillanceEntryOf(camera) === SurveillanceEntry.Watched,
    )
    .map((camera) => ({
      key: `camera-offline:${camera.id}`,
      title: `${camera.displayName} ne répond plus`,
      since: 'Hors ligne depuis',
      to: liveViewPath(camera.id),
      dismissible: true,
    }))

  // A miss no act of the user caused: a range or a restart asked the camera (PRIV-05).
  for (const camera of cameras) {
    const notice = privacyMissNotice(camera)
    if (!notice || privacyActing.includes(camera.id) || privacyMissesTold.includes(notice.key))
      continue
    alerts.push({
      key: notice.key,
      title: notice.title,
      detail: notice.missing
        ? `${notice.missing.charAt(0).toUpperCase()}${notice.missing.slice(1)}`
        : camera.privacyModeActive
          ? 'Enregistrement désactivé'
          : 'Enregistrement repris',
      to:
        surveillanceEntryOf(camera) === SurveillanceEntry.Watched
          ? liveViewPath(camera.id)
          : `/settings/cameras/${camera.id}`,
      dismissible: true,
    })
  }

  const engine = systemStats?.status
  switch (engine) {
    case 'restarting':
      alerts.push({
        key: 'engine-restarting',
        title: 'La surveillance redémarre',
        since: 'Depuis',
        dismissible: true,
      })
      break
    case 'unavailable':
      alerts.push({
        key: 'engine-unavailable',
        title: 'La surveillance est arrêtée',
        since: 'Depuis',
        dismissible: true,
      })
      break
    case 'active':
    case undefined:
      break
    default: {
      const unknown: never = engine
      return unknown
    }
  }

  if (systemStats?.storage && isStorageCritical(systemStats.storage))
    alerts.push({
      key: 'storage-critical',
      title: 'Disque presque plein',
      detail: `${systemStats.storage.freeGb} Go libres`,
      to: '/settings/retention',
      dismissible: true,
    })

  if (restartFailed)
    alerts.push({
      key: 'restart-failed',
      title: 'Les changements ne sont pas appliqués',
      detail: 'Réessayez depuis les réglages',
      to: '/settings',
      dismissible: true,
    })

  return alerts
}

/** When each alert was first seen: a new one starts now, an ended one is forgotten. */
export function trackFirstSeen(
  seen: Readonly<Record<string, number>>,
  keys: readonly string[],
  now: number,
): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, seen[key] ?? now]))
}

/** The alerts set aside that still last: one whose cause ended comes back if the cause returns. */
export function stillDismissed(
  dismissed: readonly string[],
  keys: readonly string[],
): readonly string[] {
  return dismissed.filter((key) => keys.includes(key))
}

/** An elapsed time as the bar reads it: « 4 min », « 2 h ». */
export function formatSince(elapsedMs: number): string {
  const minutes = Math.floor(elapsedMs / 60_000)
  if (minutes < 1) return 'moins d’une minute'
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h`
}
