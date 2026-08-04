/** Ce que l'utilisateur s'apprete a couper ou reprendre : une camera nommee, ou toutes. */
export interface PrivacyRequest {
  cameraIds: string[]
  active: boolean
  /** Le nom de la camera visee ; `null` quand la demande porte sur toutes. */
  cameraLabel: string | null
}

interface PrivacyWording {
  title: string
  body: string
  confirmLabel: string
  done: string
}

// Couper touche la camera elle-meme : c'est long, et le resultat n'est pas visible tout de suite.
// La demande se confirme et s'annonce donc de la meme facon, qu'elle vise une camera ou toutes.
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
