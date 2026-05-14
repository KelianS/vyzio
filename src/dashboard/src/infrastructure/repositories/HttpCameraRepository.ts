import type { CameraApplyResult } from '../../domain/entities/CameraApplyResult'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { Camera } from '../../domain/entities/Camera'
import type { CameraConfigurationApplyResult } from '../../domain/entities/CameraConfigurationApplyResult'
import type { CameraStatus } from '../../domain/entities/CameraStatus'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import type { VendorAssistance } from '../../domain/entities/VendorAssistance'
import type { CameraRepository } from '../../domain/ports/CameraRepository'
import type { VendorAssistanceRequest } from '../../domain/ports/CameraRepository'
import { fetchJson } from '../http/fetchJson'

interface CameraDto {
  id: string
  slug: string
  displayName: string
  sourceType: string
  host: string
  port: number
  username: string | null
  streamPath: string | null
  status: string
  validationState: string
  isEnabled: boolean
  previewAvailable: boolean
  needsAttention: boolean
  lastReachabilityCheckAt: string | null
  lastSuccessfulFrameAt: string | null
  frigateCameraName: string | null
  vendorFamily: string | null
}

interface CameraStatusDto {
  cameraId: string
  displayName: string
  status: string
  validationState: string
  connected: boolean
  previewAvailable: boolean
  needsAttention: boolean
  guidance: string | null
  lastReachabilityCheckAt: string | null
  lastSuccessfulFrameAt: string | null
}

interface DiscoveredCameraDto {
  displayName: string
  host: string
  port: number
  sourceType: string
  streamPath: string | null
  discoverySource: string
  note: string | null
  macAddress: string | null
  qualification: string
  supportLevel: string
  vendorFamily: string | null
  qualificationReasons: string[]
  vendorDocumentation?: VendorDocumentationDto | null
  technicalDetails?: DiscoveryTechnicalDetailsDto | null
}

interface DiscoveryTechnicalDetailsDto {
  resolvedHostName: string | null
  httpPortsDetected: number[]
  rtspPortsDetected: number[]
  onvifPortsDetected: number[]
  rtspPathsDetected: string[]
}

interface VendorDocumentationDto {
  vendorFamily: string
  markdown: string
}

interface VendorAssistanceDto {
  vendorFamily: string
  markdown: string
}

interface ApplyCameraDto {
  applied: boolean
  message: string
  configPath: string
  camera: CameraStatusDto
}

interface DeleteCameraDto {
  deleted: boolean
  message: string
  configPath: string
}

interface ApplyCameraConfigurationDto {
  applied: boolean
  message: string
  configPath: string
  cameraCount: number
}

export class HttpCameraRepository implements CameraRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getAll(): Promise<Camera[]> {
    const payload = await fetchJson<CameraDto[]>(`${this.apiBaseUrl}/api/cameras`)
    return payload.map(mapCamera)
  }

  async getStatus(cameraId: string): Promise<CameraStatus> {
    const payload = await fetchJson<CameraStatusDto>(`${this.apiBaseUrl}/api/cameras/${cameraId}/status`)
    return mapCameraStatus(payload)
  }

  async discover(): Promise<DiscoveredCamera[]> {
    const payload = await postJson<DiscoveredCameraDto[]>(`${this.apiBaseUrl}/api/cameras/discovery`)
    return payload.map(mapDiscoveredCamera)
  }

  async getVendorAssistance(input: VendorAssistanceRequest): Promise<VendorAssistance | null> {
    return postJson<VendorAssistanceDto | null>(`${this.apiBaseUrl}/api/cameras/vendor-assistance`, input)
  }

  async create(input: CameraDraftInput): Promise<Camera> {
    const payload = await postJson<CameraDto>(`${this.apiBaseUrl}/api/cameras`, input)
    return mapCamera(payload)
  }

  async update(cameraId: string, input: CameraDraftInput): Promise<Camera> {
    const payload = await putJson<CameraDto>(`${this.apiBaseUrl}/api/cameras/${cameraId}`, input)
    return mapCamera(payload)
  }

  async verifyDraft(input: CameraDraftInput): Promise<CameraStatus> {
    const payload = await postJson<CameraStatusDto>(`${this.apiBaseUrl}/api/cameras/verify-draft`, input)
    return mapCameraStatus(payload)
  }

  async verify(cameraId: string): Promise<CameraStatus> {
    const payload = await postJson<CameraStatusDto>(`${this.apiBaseUrl}/api/cameras/${cameraId}/verify`)
    return mapCameraStatus(payload)
  }

  async apply(cameraId: string): Promise<CameraApplyResult> {
    const payload = await postJson<ApplyCameraDto>(`${this.apiBaseUrl}/api/cameras/${cameraId}/apply`)
    return {
      applied: payload.applied,
      message: payload.message,
      configPath: payload.configPath,
      camera: mapCameraStatus(payload.camera),
    }
  }

  async applyConfiguration(): Promise<CameraConfigurationApplyResult> {
    return postJson<ApplyCameraConfigurationDto>(`${this.apiBaseUrl}/api/cameras/apply-configuration`)
  }

  async delete(cameraId: string): Promise<{ deleted: boolean; message: string; configPath: string }> {
    return deleteJson<DeleteCameraDto>(`${this.apiBaseUrl}/api/cameras/${cameraId}`)
  }
}

function mapCamera(camera: CameraDto): Camera {
  return {
    id: camera.id,
    slug: camera.slug,
    displayName: camera.displayName,
    sourceType: camera.sourceType,
    host: camera.host,
    port: camera.port,
    username: camera.username,
    streamPath: camera.streamPath,
    status: camera.status,
    validationState: camera.validationState,
    isEnabled: camera.isEnabled,
    previewAvailable: camera.previewAvailable,
    needsAttention: camera.needsAttention,
    lastReachabilityCheckAt: camera.lastReachabilityCheckAt,
    lastSuccessfulFrameAt: camera.lastSuccessfulFrameAt,
    frigateCameraName: camera.frigateCameraName,
    vendorFamily: camera.vendorFamily,
  }
}

function mapCameraStatus(status: CameraStatusDto): CameraStatus {
  return {
    cameraId: status.cameraId,
    displayName: status.displayName,
    status: status.status,
    validationState: status.validationState,
    connected: status.connected,
    previewAvailable: status.previewAvailable,
    needsAttention: status.needsAttention,
    guidance: status.guidance,
    lastReachabilityCheckAt: status.lastReachabilityCheckAt,
    lastSuccessfulFrameAt: status.lastSuccessfulFrameAt,
  }
}

function mapDiscoveredCamera(camera: DiscoveredCameraDto): DiscoveredCamera {
  return {
    displayName: camera.displayName,
    host: camera.host,
    port: camera.port,
    sourceType: camera.sourceType,
    streamPath: camera.streamPath,
    discoverySource: camera.discoverySource,
    note: camera.note,
    macAddress: camera.macAddress,
    qualification: camera.qualification,
    supportLevel: camera.supportLevel,
    vendorFamily: camera.vendorFamily,
    qualificationReasons: camera.qualificationReasons,
    vendorDocumentation: camera.vendorDocumentation
      ? {
          vendorFamily: camera.vendorDocumentation.vendorFamily,
          markdown: camera.vendorDocumentation.markdown,
        }
      : null,
    technicalDetails: camera.technicalDetails
      ? {
          resolvedHostName: camera.technicalDetails.resolvedHostName,
          httpPortsDetected: camera.technicalDetails.httpPortsDetected,
          rtspPortsDetected: camera.technicalDetails.rtspPortsDetected,
          onvifPortsDetected: camera.technicalDetails.onvifPortsDetected,
          rtspPathsDetected: camera.technicalDetails.rtspPathsDetected,
        }
      : null,
  }
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${url}`)
  }

  if (response.status === 204) {
    return null as T
  }

  const payload = await response.text()
  if (!payload.trim()) {
    return null as T
  }

  return JSON.parse(payload) as T
}

async function deleteJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${url}`)
  }

  return response.json() as Promise<T>
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${url}`)
  }

  return response.json() as Promise<T>
}