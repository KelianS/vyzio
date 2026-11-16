import type { SupportedProtocol } from '../../domain/entities/camera_capability_binding.entity'

export function connectionAdvancedPath(cameraId: string) {
  return `/settings/cameras/${cameraId}/connection/advanced`
}

export function protocolPath(cameraId: string, protocol: SupportedProtocol) {
  return `${connectionAdvancedPath(cameraId)}/protocols/${protocol}`
}
