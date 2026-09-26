import type { FrigateStatus } from '../../domain/entities/system_stats.entity'

const RESTARTING: Record<FrigateStatus, boolean> = {
  active: false,
  restarting: true,
  unavailable: false,
}

/** What a live picture says while it waits, or null once it shows; a restart outranks a lost frame. */
export function liveWaitMessage(status: FrigateStatus, imageError: boolean): string | null {
  if (RESTARTING[status]) return 'Redémarrage en cours…'
  return imageError ? 'Reconnexion…' : null
}

/** The camera's latest frame, with a fresh query so the browser fetches it again. */
export function liveFrameUrl(apiBaseUrl: string, cameraId: string): string {
  return `${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`
}
