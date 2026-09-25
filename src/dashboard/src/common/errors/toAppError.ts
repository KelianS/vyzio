import { ApiErrorCode, AppErrorKind } from './AppError'
import type { AppError } from './AppError'
import { scrubSecrets } from './scrubSecrets'

const DIAGNOSTIC_LENGTH = 500

// A refusal whose code is known reads as what to do; any other keeps the generic sentence.
const KNOWN_REFUSALS = new Map<string, string>([
  [ApiErrorCode.NotCalibrated, 'Cette caméra doit d’abord être calibrée'],
])

function isHttpLike(e: unknown): e is { status: number; code?: unknown } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    typeof (e as Record<string, unknown>).status === 'number'
  )
}

/** Read without importing the infrastructure: an HttpError or a NetworkError carries its own line. */
function diagnosticOf(e: unknown): string | undefined {
  let line: string | undefined
  if (typeof e === 'object' && e !== null && 'diagnostic' in e) {
    const diagnostic = (e as Record<string, unknown>).diagnostic
    if (typeof diagnostic === 'string' && diagnostic.trim()) line = diagnostic
  }
  if (line === undefined && e instanceof Error) line = `${e.name}: ${e.message}`
  // Scrubbed before being cut, so a cut never lands inside an address and leaves its secret behind.
  return line === undefined ? undefined : scrubSecrets(line).slice(0, DIAGNOSTIC_LENGTH)
}

function kindOf(e: unknown, code: string | undefined): AppError {
  if (e instanceof TypeError) {
    return { kind: AppErrorKind.Network }
  }
  if (isHttpLike(e)) {
    if (e.status === 404) return { kind: AppErrorKind.NotFound }
    if (e.status === 503) return { kind: AppErrorKind.SurveillanceDown }
    if (e.status >= 500) return { kind: AppErrorKind.Server, status: e.status }
    const known = code === undefined ? undefined : KNOWN_REFUSALS.get(code)
    return { kind: AppErrorKind.Unknown, message: known ?? 'La demande n’a pas abouti' }
  }
  return { kind: AppErrorKind.Unknown, message: 'Une erreur inattendue s’est produite' }
}

export function toAppError(e: unknown): AppError {
  const code = isHttpLike(e) && typeof e.code === 'string' ? e.code : undefined
  const error = kindOf(e, code)
  const diagnostic = diagnosticOf(e)
  return { ...error, ...(diagnostic && { diagnostic }), ...(code && { code }) }
}
