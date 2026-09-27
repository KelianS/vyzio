import type { AppError } from '../../common/errors/app_error'
import type { CameraPrivacySchedule } from '../../domain/entities/camera_privacy_schedule.entity'

/** The range being composed, before it is added to one camera or to all. */
export interface ScheduleForm {
  /** [0..6], 0 = Sunday. */
  days: number[]
  startTime: string
  endTime: string
}

export interface CameraPrivacyUido {
  /** Whether the Parking and Surveillance positions are saved; null while unknown or without PTZ. */
  positionsSaved: boolean | null
  presetsError: AppError | null
  saving: boolean

  schedules: CameraPrivacySchedule[]
  schedulesLoading: boolean
  schedulesError: AppError | null
  /** The add form stays folded behind its button until asked for. */
  formOpen: boolean
  form: ScheduleForm
  adding: boolean
  invalid: string | null
  scheduleFailure: AppError | null
}

export const EMPTY_SCHEDULE_FORM: ScheduleForm = {
  days: [1, 2, 3, 4, 5],
  startTime: '22:00',
  endTime: '06:00',
}

export function buildInitialCameraPrivacyUido(): CameraPrivacyUido {
  return {
    positionsSaved: null,
    presetsError: null,
    saving: false,

    schedules: [],
    schedulesLoading: true,
    schedulesError: null,
    formOpen: false,
    form: EMPTY_SCHEDULE_FORM,
    adding: false,
    invalid: null,
    scheduleFailure: null,
  }
}
