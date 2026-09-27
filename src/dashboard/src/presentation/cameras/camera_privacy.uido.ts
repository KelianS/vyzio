import type { AppError } from '../../common/errors/app_error'
import type { ScheduleRule } from '../../domain/entities/schedule_rule.entity'

export interface CameraPrivacyUido {
  /** Whether the Parking and Surveillance positions are saved; null while unknown or without PTZ. */
  positionsSaved: boolean | null
  presetsError: AppError | null
  saving: boolean

  /** The house's rules, to count those aiming at this camera; null while unread. */
  rules: ScheduleRule[] | null
  rulesError: AppError | null
}

export function buildInitialCameraPrivacyUido(): CameraPrivacyUido {
  return {
    positionsSaved: null,
    presetsError: null,
    saving: false,

    rules: null,
    rulesError: null,
  }
}
