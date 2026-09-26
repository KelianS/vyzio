/** What the user is about to cut or resume: one named camera, or all of them. */
export interface PrivacyRequest {
  cameraIds: string[]
  active: boolean
  /** The name of the camera aimed at; `null` when the request covers all of them. */
  cameraLabel: string | null
}

interface PrivacyWording {
  title: string
  body: string
  confirmLabel: string
  done: string
}

// Cutting reaches the camera itself: it takes time, and the result is not visible right away.
// So the request is confirmed and announced the same way, whether it aims at one camera or all.
export function privacyWording({ active, cameraLabel }: PrivacyRequest): PrivacyWording {
  const target = cameraLabel === null ? 'toutes les caméras' : `« ${cameraLabel} »`

  return active
    ? {
        title: cameraLabel === null ? 'Couper toutes les caméras ?' : `Mettre ${target} en pause ?`,
        body:
          cameraLabel === null
            ? 'Plus rien n’est enregistré ni signalé tant que vous ne les rallumez pas.'
            : 'Plus rien n’est enregistré ni signalé par cette caméra tant que vous ne la rallumez pas.',
        confirmLabel: cameraLabel === null ? 'Tout couper' : 'Mettre en pause',
        done: cameraLabel === null ? 'Caméras coupées.' : `${cameraLabel} est en pause.`,
      }
    : {
        title: 'Reprendre la surveillance ?',
        body:
          cameraLabel === null
            ? 'Les caméras recommencent à enregistrer et à vous signaler ce qu’elles voient.'
            : 'Cette caméra recommence à enregistrer et à vous signaler ce qu’elle voit.',
        confirmLabel: 'Reprendre',
        done:
          cameraLabel === null
            ? 'Surveillance reprise.'
            : `${cameraLabel} est de nouveau surveillée.`,
      }
}
