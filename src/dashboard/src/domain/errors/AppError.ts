export const AppErrorKind = {
  NotFound: 'not_found',
  Network: 'network',
  Server: 'server',
  Unknown: 'unknown',
} as const

type AppErrorKind = (typeof AppErrorKind)[keyof typeof AppErrorKind]

export type AppError =
  | { kind: typeof AppErrorKind.NotFound }
  | { kind: typeof AppErrorKind.Network }
  | { kind: typeof AppErrorKind.Server; status: number }
  | { kind: typeof AppErrorKind.Unknown; message: string }

export function appErrorMessage(error: AppError): string {
  switch (error.kind) {
    case AppErrorKind.NotFound:
      return 'Ressource introuvable'
    case AppErrorKind.Network:
      return 'Impossible de joindre le serveur'
    case AppErrorKind.Server:
      return `Erreur serveur (${error.status})`
    case AppErrorKind.Unknown:
      return error.message
  }
}
