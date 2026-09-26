import type { BadgeTone } from '../../common/components/Badge'
import type { Camera } from '../../domain/entities/Camera'

export function formatCameraStatusLabel(status: string): string {
  switch (status) {
    case 'online':
      return 'Connectée'
    case 'offline':
      return 'Hors ligne'
    case 'degraded':
      return 'Dégradée'
    case 'config_error':
      return 'Erreur de configuration'
    default:
      return 'À vérifier'
  }
}

export function formatCameraAddress(camera: Camera): string {
  return `${camera.host}:${camera.port}`
}

export function formatStatusTone(camera: Camera): BadgeTone {
  if (camera.status === 'online' && !camera.needsAttention) return 'ok'
  if (camera.status === 'offline') return 'danger'
  return 'warn'
}
