import { describe, expect, it } from 'vitest'
import { ApiErrorCode, AppErrorKind, appErrorDiagnostic, appErrorMessage } from './AppError'
import { toAppError } from './toAppError'

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
    const error = toAppError(failedCall(500, 'GET /api/hub · 500 Internal Server Error'))

    expect(error.kind).toBe(AppErrorKind.Server)
    expect(appErrorDiagnostic(error)).toBe('GET /api/hub · 500 Internal Server Error')
  })

  it('toAppError_ShouldStillReadAsANetworkFailure_WhenTheRequestGotNoAnswer', () => {
    const error = toAppError(noAnswer('GET /api/hub · Failed to fetch'))

    expect(error.kind).toBe(AppErrorKind.Network)
    expect(appErrorDiagnostic(error)).toBe('GET /api/hub · Failed to fetch')
  })

  it('toAppError_ShouldKeepThePlainSentence_WhenTheRefusalCarriesNoKnownCode', () => {
    const error = toAppError(
      failedCall(400, 'POST /api/cameras · 400 Bad Request · name_taken', 'name_taken'),
    )

    expect(appErrorMessage(error)).toBe('La demande n’a pas abouti')
    expect(error.code).toBe('name_taken')
  })

  it('toAppError_ShouldSayWhatToDo_WhenTheRefusalCarriesAKnownCode', () => {
    const error = toAppError(
      failedCall(409, 'PUT /api/cameras/c/ptz/presets/2 · 409', ApiErrorCode.NotCalibrated),
    )

    expect(appErrorMessage(error)).toBe('Cette caméra doit d’abord être calibrée')
    expect(error.code).toBe(ApiErrorCode.NotCalibrated)
  })

  it('toAppError_ShouldReadAsACameraRefusal_WhenTheApiNamesIt', () => {
    const error = toAppError(
      failedCall(502, 'POST /api/x · 502 · camera_refused', ApiErrorCode.CameraRefused),
    )

    expect(error.kind).toBe(AppErrorKind.CameraRefused)
  })

  it('toAppError_ShouldReadAsAnUnreachableCamera_WhenTheApiNamesIt', () => {
    const error = toAppError(
      failedCall(502, 'POST /api/x · 502 · camera_unreachable', ApiErrorCode.CameraUnreachable),
    )

    expect(error.kind).toBe(AppErrorKind.CameraUnreachable)
  })

  it('toAppError_ShouldNotBlameTheCamera_WhenAProxyAnswers502WithoutACode', () => {
    const error = toAppError(failedCall(502, 'GET /api/hub · 502 Bad Gateway'))

    expect(error.kind).toBe(AppErrorKind.Server)
  })

  it('toAppError_ShouldGiveAPlainSentenceAndKeepTheTechnicalText_WhenTheErrorIsUnexpected', () => {
    const error = toAppError(new RangeError('Invalid time value'))

    expect(appErrorMessage(error)).toBe('Une erreur inattendue s’est produite')
    expect(appErrorDiagnostic(error)).toBe('RangeError: Invalid time value')
  })

  it('toAppError_ShouldScrubTheCredentials_WhenThePasswordHoldsAnAtOrASlash', () => {
    const diagnostic =
      appErrorDiagnostic(
        toAppError(new Error('Cannot open rtsp://viewer:p@ss/w0rd?@192.168.1.10:554/stream1')),
      ) ?? ''

    expect(diagnostic).not.toContain('viewer')
    expect(diagnostic).not.toContain('ss/w0rd')
    expect(diagnostic).toContain('rtsp://***@192.168.1.10:554/stream1')
  })

  it('toAppError_ShouldScrubTheSecret_WhenTheDiagnosticCarriesASecretFieldInAnyForm', () => {
    const line = 'GET /api/x · 500 · token=abc123&password=hunter2 · {"api_key":"k-9","pwd": "x1"}'

    const diagnostic = appErrorDiagnostic(toAppError(failedCall(500, line))) ?? ''

    expect(diagnostic).toBe(
      'GET /api/x · 500 · token=***&password=*** · {"api_key":"***","pwd": "***"}',
    )
  })

  it('toAppError_ShouldScrubBeforeCutting_WhenALongLineEndsInsideAnAddress', () => {
    const line = `${'x'.repeat(480)} rtsp://viewer:s3cret@192.168.1.10:554/stream1`

    const diagnostic = appErrorDiagnostic(toAppError(failedCall(500, line))) ?? ''

    expect(diagnostic).not.toContain('s3cret')
    expect(diagnostic).not.toContain('viewer')
  })
})
