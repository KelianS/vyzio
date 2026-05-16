import type { Profile } from '../../domain/entities/Profile'
import type { ProfilePhoto } from '../../domain/entities/ProfilePhoto'
import type { ProfileCameraLink } from '../../domain/entities/ProfileCameraLink'
import type { DetectionConfig } from '../../domain/entities/DetectionConfig'
import type { DetectionHistoryPage, DetectionHistoryQuery } from '../../domain/entities/DetectionHistory'
import type {
  ProfileRepository,
  CreateProfileRequest,
  UpdateProfileRequest,
} from '../../domain/ports/ProfileRepository'
import { fetchJson } from '../http/fetchJson'

export class HttpProfileRepository implements ProfileRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getAll(): Promise<Profile[]> {
    return fetchJson<Profile[]>(`${this.apiBaseUrl}/api/profiles`)
  }

  async getById(id: string): Promise<Profile | null> {
    return fetchJson<Profile | null>(`${this.apiBaseUrl}/api/profiles/${id}`)
  }

  async create(request: CreateProfileRequest): Promise<Profile> {
    return postJson<Profile>(`${this.apiBaseUrl}/api/profiles`, request)
  }

  async update(id: string, request: UpdateProfileRequest): Promise<Profile> {
    return putJson<Profile>(`${this.apiBaseUrl}/api/profiles/${id}`, request)
  }

  async delete(id: string): Promise<void> {
    await deleteReq(`${this.apiBaseUrl}/api/profiles/${id}`)
  }

  async getPhotos(profileId: string): Promise<ProfilePhoto[]> {
    return fetchJson<ProfilePhoto[]>(`${this.apiBaseUrl}/api/profiles/${profileId}/photos`)
  }

  async addPhoto(profileId: string, file: File): Promise<ProfilePhoto> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${this.apiBaseUrl}/api/profiles/${profileId}/photos`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json() as Promise<ProfilePhoto>
  }

  async removePhoto(profileId: string, photoId: string): Promise<void> {
    await deleteReq(`${this.apiBaseUrl}/api/profiles/${profileId}/photos/${photoId}`)
  }

  async getCameraLinks(profileId: string): Promise<ProfileCameraLink[]> {
    return fetchJson<ProfileCameraLink[]>(`${this.apiBaseUrl}/api/profiles/${profileId}/camera-links`)
  }

  async setCameraLinks(profileId: string, cameraIds: string[]): Promise<ProfileCameraLink[]> {
    return putJson<ProfileCameraLink[]>(`${this.apiBaseUrl}/api/profiles/${profileId}/camera-links`, { cameraIds })
  }

  async getCameraProfileLinks(cameraId: string): Promise<ProfileCameraLink[]> {
    return fetchJson<ProfileCameraLink[]>(`${this.apiBaseUrl}/api/cameras/${cameraId}/profile-links`)
  }

  async setCameraProfileLinks(cameraId: string, profileIds: string[]): Promise<ProfileCameraLink[]> {
    return putJson<ProfileCameraLink[]>(`${this.apiBaseUrl}/api/cameras/${cameraId}/profile-links`, { profileIds })
  }

  async getCameraDetectionConfig(cameraId: string): Promise<DetectionConfig | null> {
    const response = await fetch(`${this.apiBaseUrl}/api/cameras/${cameraId}/detection-config`, {
      headers: { Accept: 'application/json' },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json() as Promise<DetectionConfig>
  }

  async saveCameraDetectionConfig(cameraId: string, labels: string[], continuousRecordingEnabled: boolean): Promise<DetectionConfig> {
    return putJson<DetectionConfig>(`${this.apiBaseUrl}/api/cameras/${cameraId}/detection-config`, { labels, continuousRecordingEnabled })
  }

  async getDetectionHistory(query: DetectionHistoryQuery): Promise<DetectionHistoryPage> {
    const params = new URLSearchParams()
    if (query.camera) params.set('camera', query.camera)
    if (query.label) params.set('label', query.label)
    if (query.profileId) params.set('profileId', query.profileId)
    if (query.from) params.set('from', query.from)
    if (query.to) params.set('to', query.to)
    if (query.page !== undefined) params.set('page', String(query.page))
    if (query.limit !== undefined) params.set('limit', String(query.limit))
    return fetchJson<DetectionHistoryPage>(`${this.apiBaseUrl}/api/detection-events/history?${params}`)
  }

  async resyncFaceLibrary(): Promise<number> {
    const result = await postJson<{ synced: number }>(`${this.apiBaseUrl}/api/profiles/resync-face-library`, {})
    return result.synced
  }

  async correctDetectionIdentity(eventId: string, profileId: string | null): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/detection-events/${eventId}/identity`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ profileId }),
    })
    if (!response.ok && response.status !== 204) throw new Error(`HTTP ${response.status}`)
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} on ${url}`)
  return response.json() as Promise<T>
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} on ${url}`)
  return response.json() as Promise<T>
}

async function deleteReq(url: string): Promise<void> {
  const response = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } })
  if (!response.ok && response.status !== 204) throw new Error(`HTTP ${response.status} on ${url}`)
}
