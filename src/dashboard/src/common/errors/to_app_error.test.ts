import { describe, expect, it } from 'vitest'
import { ApiErrorCode, AppErrorKind, appErrorDiagnostic, appErrorMessage } from './app_error'
import { toAppError } from './to_app_error'

// Shaped like the infrastructure's errors, which toAppError reads without importing them.
const failedCall = (status: number, diagnostic: string, code?: string) => ({
  status,
  diagnostic,
  code,
})
const noAnswer = (diagnostic: string) =>
  Object.assign(new TypeError('Failed to fetch'), { diagnostic })

describe('toAppError', () => {
  it('toAppError_ShouldCarryTheDiagnosticLine_WhenTheRequestFailed', () => {
    // Arrange & Act
    const error = toAppError(failedCall(500, 'GET /api/hub · 500 Internal Server Error'))

    // Assert
    expect(error.kind).toBe(AppErrorKind.Server)
    expect(appErrorDiagnostic(error)).toBe('GET /api/hub · 500 Internal Server Error')
  })

  it('toAppError_ShouldStillReadAsANetworkFailure_WhenTheRequestGotNoAnswer', () => {
    // Arrange & Act
    const error = toAppError(noAnswer('GET /api/hub · Failed to fetch'))

    // Assert
    expect(error.kind).toBe(AppErrorKind.Network)
    expect(appErrorDiagnostic(error)).toBe('GET /api/hub · Failed to fetch')
  })

  it('toAppError_ShouldKeepThePlainSentence_WhenTheRefusalCarriesNoKnownCode', () => {
    // Arrange & Act
    const error = toAppError(
      failedCall(400, 'POST /api/cameras · 400 Bad Request · name_taken', 'name_taken'),
    )

    // Assert
    expect(appErrorMessage(error)).toBe('La demande n’a pas abouti')
    expect(error.code).toBe('name_taken')
  })

  it('toAppError_ShouldSayWhatToDo_WhenTheRefusalCarriesAKnownCode', () => {
    // Arrange & Act
    const error = toAppError(
      failedCall(409, 'PUT /api/cameras/c/ptz/presets/2 · 409', ApiErrorCode.NotCalibrated),
    )

    // Assert
    expect(appErrorMessage(error)).toBe('Cette caméra doit d’abord être calibrée')
    expect(error.code).toBe(ApiErrorCode.NotCalibrated)
  })

  it.each([
    [ApiErrorCode.ScheduleNoDay, 'Choisissez au moins un jour'],
    [
      ApiErrorCode.ScheduleInvalidTime,
      'Indiquez une heure de début et une heure de fin, par exemple 22:00',
    ],
    [
      ApiErrorCode.ScheduleEmptyRange,
      'Le début et la fin sont à la même heure : choisissez deux heures différentes',
    ],
    [ApiErrorCode.ScheduleNoTarget, 'Choisissez au moins une caméra ou un canal pour cette plage'],
    [
      ApiErrorCode.ScheduleUnknownTarget,
      'Une caméra ou un canal choisi n’existe plus : revoyez la liste, puis enregistrez de nouveau',
    ],
  ])('toAppError_ShouldSayWhatToChange_WhenTheScheduleIsRefusedWith %s', (code, sentence) => {
    // Arrange & Act
    const error = toAppError(failedCall(400, `POST /api/schedules · 400 · ${code}`, code))

    // Assert
    expect(appErrorMessage(error)).toBe(sentence)
  })

  it('toAppError_ShouldSayWhereToSaveThePositions_WhenParkingIsRefusedForLackOfThem', () => {
    // Arrange & Act
    const error = toAppError(
      failedCall(
        409,
        'PATCH /api/cameras/c/privacy-strategy · 409 · parking_positions_missing',
        ApiErrorCode.ParkingPositionsMissing,
      ),
    )

    // Assert
    expect(appErrorMessage(error)).toContain('positions Surveillance et Parking')
  })

  it('toAppError_ShouldReadAsACameraRefusal_WhenTheApiNamesIt', () => {
    // Arrange & Act
    const error = toAppError(
      failedCall(502, 'POST /api/x · 502 · camera_refused', ApiErrorCode.CameraRefused),
    )

    // Assert
    expect(error.kind).toBe(AppErrorKind.CameraRefused)
  })

  it('toAppError_ShouldReadAsAnUnreachableCamera_WhenTheApiNamesIt', () => {
    // Arrange & Act
    const error = toAppError(
      failedCall(502, 'POST /api/x · 502 · camera_unreachable', ApiErrorCode.CameraUnreachable),
    )

    // Assert
    expect(error.kind).toBe(AppErrorKind.CameraUnreachable)
  })

  it('toAppError_ShouldNotBlameTheCamera_WhenAProxyAnswers502WithoutACode', () => {
    // Arrange & Act
    const error = toAppError(failedCall(502, 'GET /api/hub · 502 Bad Gateway'))

    // Assert
    expect(error.kind).toBe(AppErrorKind.Server)
  })

  it('toAppError_ShouldGiveAPlainSentenceAndKeepTheTechnicalText_WhenTheErrorIsUnexpected', () => {
    // Arrange & Act
    const error = toAppError(new RangeError('Invalid time value'))

    // Assert
    expect(appErrorMessage(error)).toBe('Une erreur inattendue s’est produite')
    expect(appErrorDiagnostic(error)).toBe('RangeError: Invalid time value')
  })

  it('toAppError_ShouldScrubTheCredentials_WhenThePasswordHoldsAnAtOrASlash', () => {
    // Arrange & Act
    const diagnostic =
      appErrorDiagnostic(
        toAppError(new Error('Cannot open rtsp://viewer:p@ss/w0rd?@192.168.1.10:554/stream1')),
      ) ?? ''

    // Assert
    expect(diagnostic).not.toContain('viewer')
    expect(diagnostic).not.toContain('ss/w0rd')
    expect(diagnostic).toContain('rtsp://***@192.168.1.10:554/stream1')
  })

  it('toAppError_ShouldScrubTheSecret_WhenTheDiagnosticCarriesASecretFieldInAnyForm', () => {
    // Arrange
    const line = 'GET /api/x · 500 · token=abc123&password=hunter2 · {"api_key":"k-9","pwd": "x1"}'

    // Act
    const diagnostic = appErrorDiagnostic(toAppError(failedCall(500, line))) ?? ''

    // Assert
    expect(diagnostic).toBe(
      'GET /api/x · 500 · token=***&password=*** · {"api_key":"***","pwd": "***"}',
    )
  })

  it('toAppError_ShouldScrubBeforeCutting_WhenALongLineEndsInsideAnAddress', () => {
    // Arrange
    const line = `${'x'.repeat(480)} rtsp://viewer:s3cret@192.168.1.10:554/stream1`

    // Act
    const diagnostic = appErrorDiagnostic(toAppError(failedCall(500, line))) ?? ''

    // Assert
    expect(diagnostic).not.toContain('s3cret')
    expect(diagnostic).not.toContain('viewer')
  })
})
