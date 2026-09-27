import type { AppError } from '../../common/errors/app_error'
import type { ProfilePhoto } from '../../domain/entities/profile_photo.entity'

export type PersonPhotosAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; photos: ProfilePhoto[] }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'RELOAD_FAILED' }
  | { type: 'UPLOAD_STARTED' }
  | { type: 'UPLOAD_FINISHED' }
  | { type: 'REMOVE_ASKED'; photoId: string }
  | { type: 'REMOVE_CANCELLED' }
  | { type: 'REMOVE_STARTED' }
  | { type: 'REMOVE_FINISHED' }
  | { type: 'RESYNC_ASKED' }
  | { type: 'RESYNC_CANCELLED' }
  | { type: 'RESYNC_STARTED' }
  | { type: 'RESYNC_FINISHED' }
