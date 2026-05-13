import type { CameraApplyResult } from '../../domain/entities/CameraApplyResult'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { Camera } from '../../domain/entities/Camera'
import type { CameraStatus } from '../../domain/entities/CameraStatus'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'
import { fetchJson } from '../http/fetchJson'

interface CameraDto {
  id: string
  slug: string
  displayName: string
  sourceType: string
  host: string
  port: number
  status: string
  validationState: string
  isEnabled: boolean
  previewAvailable: boolean
  needsAttention: boolean
  lastReachabilityCheckAt: string | null
  lastSuccessfulFrameAt: string | null
  frigateCameraName: string | null
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

  async create(input: CameraDraftInput): Promise<Camera> {
    const payload = await postJson<CameraDto>(`${this.apiBaseUrl}/api/cameras`, input)
    return mapCamera(payload)
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
    status: camera.status,
    validationState: camera.validationState,
    isEnabled: camera.isEnabled,
    previewAvailable: camera.previewAvailable,
    needsAttention: camera.needsAttention,
    lastReachabilityCheckAt: camera.lastReachabilityCheckAt,
    lastSuccessfulFrameAt: camera.lastSuccessfulFrameAt,
    frigateCameraName: camera.frigateCameraName,
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

  return response.json() as Promise<T>
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