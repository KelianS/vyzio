import { AppErrorKind } from './AppError'
import type { AppError } from './AppError'

function isHttpLike(e: unknown): e is { status: number } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    typeof (e as Record<string, unknown>).status === 'number'
  )
}

export function toAppError(e: unknown): AppError {
  if (e instanceof TypeError) {
    return { kind: AppErrorKind.Network }
  }
  if (isHttpLike(e)) {
    if (e.status === 404) return { kind: AppErrorKind.NotFound }
    if (e.status === 503) return { kind: AppErrorKind.SurveillanceDown }
    if (e.status >= 500) return { kind: AppErrorKind.Server, status: e.status }
    return { kind: AppErrorKind.Unknown, message: `HTTP ${e.status}` }
  }
  if (e instanceof Error) {
    return { kind: AppErrorKind.Unknown, message: e.message }
  }
  return { kind: AppErrorKind.Unknown, message: 'Erreur inconnue' }
}
