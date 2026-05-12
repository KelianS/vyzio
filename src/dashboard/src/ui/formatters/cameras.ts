import type { Camera } from '../../domain/entities/Camera'
import type { CameraStatus } from '../../domain/entities/CameraStatus'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatCameraStatusLabel(status: string): string {
  switch (status) {
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

export function formatValidationStateLabel(state: string): string {
  switch (state) {
    case 'validated':
      return 'Validee'
    case 'draft':
      return 'Configuration inachevee'
    default:
      return 'En attente'
  }
}

export function formatCameraAddress(camera: Camera): string {
  return `${camera.host}:${camera.port}`
}

export function formatStatusTone(camera: Camera): 'ok' | 'warning' | 'degraded' {
  if (camera.status === 'online' && !camera.needsAttention) {
    return 'ok'
  }

  if (camera.status === 'degraded') {
    return 'degraded'
  }

  return 'warning'
}

export function formatCameraCheck(timestamp: string | null): string {
  return timestamp ? `Verifiee a ${dateFormatter.format(new Date(timestamp))}` : 'Jamais verifiee'
}

export function formatCameraPreview(status: CameraStatus | null): string {
  if (!status) {
    return 'Choisissez une camera pour voir son etat detaille.'
  }

  if (status.previewAvailable) {
    return 'Le flux a ete verifie recemment cote systeme. Aucun apercu video n\'est encore affiche dans cette page.'
  }

  return 'Le systeme n\'a pas encore confirme recemment le flux.'
}