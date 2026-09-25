import type { BadgeTone } from '../../common/components/Badge'
import type { Camera } from '../../domain/entities/Camera'

export function formatCameraStatusLabel(camera: Camera): string {
  // A refused password is its own cause, never passed off as the camera being away (SPECS 2.2).
  if (camera.accountRefusedAt) return 'Mot de passe refusé'
  switch (camera.status) {
    case 'online':
      return 'Connectee'
    case 'offline':
      return 'Hors ligne'
    case 'degraded':
      return 'Degradee'
    case 'config_error':
      return 'Erreur de configuration'
    default:
      return 'A verifier'
  }
}

export function formatCameraAddress(camera: Camera): string {
  return `${camera.host}:${camera.port}`
}

export function formatStatusTone(camera: Camera): BadgeTone {
  if (camera.accountRefusedAt) return 'danger'
  if (camera.status === 'online' && !camera.needsAttention) return 'ok'
  if (camera.status === 'offline') return 'danger'
  return 'warn'
}
