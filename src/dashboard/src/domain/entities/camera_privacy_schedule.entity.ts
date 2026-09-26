export interface CameraPrivacySchedule {
  id: string
  cameraId: string
  enabled: boolean
  daysOfWeek: number[] // [0..6], 0 = Sunday
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  createdAt: string
}
