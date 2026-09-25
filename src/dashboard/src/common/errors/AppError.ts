export const AppErrorKind = {
  NotFound: 'not_found',
  Network: 'network',
  /** Surveillance is not answering - distinct from a Vyzio server failure, which did answer (ADR-49). */
  SurveillanceDown: 'surveillance_down',
  /** The camera answered and said no (ADR-56); why is in the diagnostic line. */
  CameraRefused: 'camera_refused',
  /** The camera could not be reached or understood; distinct from a refusal (ADR-56). */
  CameraUnreachable: 'camera_unreachable',
  Server: 'server',
  Unknown: 'unknown',
} as const

type AppErrorKind = (typeof AppErrorKind)[keyof typeof AppErrorKind]

/** The codes the API names that a screen acts on; a code nobody expects stays in the diagnostic line. */
export const ApiErrorCode = {
  NotCalibrated: 'not_calibrated',
  CameraRefused: 'camera_refused',
  CameraUnreachable: 'camera_unreachable',
  ScheduleNoDay: 'schedule_no_day',
  ScheduleInvalidTime: 'schedule_invalid_time',
  ScheduleEmptyRange: 'schedule_empty_range',
} as const

/** What support reads under the sentence (SPECS 1.5), and the code the API named, if any. */
interface Diagnosable {
  diagnostic?: string
  code?: string
}

export type AppError = Diagnosable &
  (
    | { kind: typeof AppErrorKind.NotFound }
    | { kind: typeof AppErrorKind.Network }
    | { kind: typeof AppErrorKind.SurveillanceDown }
    | { kind: typeof AppErrorKind.CameraRefused }
    | { kind: typeof AppErrorKind.CameraUnreachable }
    | { kind: typeof AppErrorKind.Server; status: number }
    | { kind: typeof AppErrorKind.Unknown; message: string }
  )

export function appErrorMessage(error: AppError): string {
  switch (error.kind) {
    case AppErrorKind.NotFound:
      return 'Élément introuvable : il a peut-être été supprimé'
    case AppErrorKind.Network:
      return 'Impossible de joindre le serveur'
    case AppErrorKind.SurveillanceDown:
      return 'La surveillance ne répond pas'
    case AppErrorKind.CameraRefused:
      return 'La caméra a refusé la commande'
    case AppErrorKind.CameraUnreachable:
      return 'La caméra ne répond pas'
    case AppErrorKind.Server:
      return 'Vyzio a rencontré une erreur, réessayez dans un instant'
    case AppErrorKind.Unknown:
      return error.message
  }
}

export function appErrorDiagnostic(error: AppError): string | undefined {
  return error.diagnostic
}

/** The one way an error becomes a toast: its sentence and its diagnostic line, together. */
export function toastError(
  toast: (message: string, tone: 'error', diagnostic?: string) => void,
  error: AppError,
  sentence: string = appErrorMessage(error),
): void {
  toast(sentence, 'error', appErrorDiagnostic(error))
}
