import type { Profile } from '../entities/Profile'
import type { ProfilePhoto } from '../entities/ProfilePhoto'
import type { ProfileCameraLink } from '../entities/ProfileCameraLink'
import type { DetectionConfig } from '../entities/DetectionConfig'
import type { DetectionHistoryPage, DetectionHistoryQuery } from '../entities/DetectionHistory'

export interface CreateProfileRequest {
  name: string
  category: string
  alertMode: string
}

export interface UpdateProfileRequest {
  name: string
  category: string
  alertMode: string
}

export interface ProfileRepository {
  getAll(): Promise<Profile[]>
  getById(id: string): Promise<Profile | null>
  create(request: CreateProfileRequest): Promise<Profile>
  update(id: string, request: UpdateProfileRequest): Promise<Profile>
  delete(id: string): Promise<void>

  getPhotos(profileId: string): Promise<ProfilePhoto[]>
  addPhoto(profileId: string, file: File): Promise<ProfilePhoto>
  removePhoto(profileId: string, photoId: string): Promise<void>

  getCameraLinks(profileId: string): Promise<ProfileCameraLink[]>
  setCameraLinks(profileId: string, cameraIds: string[]): Promise<ProfileCameraLink[]>

  getCameraProfileLinks(cameraId: string): Promise<ProfileCameraLink[]>
  setCameraProfileLinks(cameraId: string, profileIds: string[]): Promise<ProfileCameraLink[]>

  getCameraDetectionConfig(cameraId: string): Promise<DetectionConfig | null>
  saveCameraDetectionConfig(cameraId: string, labels: string[], continuousRecordingEnabled: boolean): Promise<DetectionConfig>

  resyncFaceLibrary(): Promise<number>

  getDetectionHistory(query: DetectionHistoryQuery): Promise<DetectionHistoryPage>
  correctDetectionIdentity(eventId: string, profileId: string | null): Promise<void>
}
