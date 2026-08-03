import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'

/**
 * Ce que l'on est en train d'ajouter : une camera trouvee sur le reseau, ou une
 * adresse saisie a la main. L'ancienne union melait a cela la selection d'une
 * camera **existante** — un objet deja regle n'ayant rien a faire dans un ecran
 * d'ajout, il vit maintenant sous sa propre route (ADR-40).
 */
export type AddCameraSelection = { kind: 'manual' } | { kind: 'candidate'; index: number }

export const emptyCameraDraft: CameraDraftInput = {
  displayName: '',
  host: '',
  port: 554,
  username: null,
  password: null,
  streamPath: null,
  vendorFamily: null,
  sourceType: 'rtsp_manual',
  streamProtocol: 'rtsp',
}

export interface AddCameraUido {
  selection: AddCameraSelection
  form: CameraDraftInput
  /** Voie de secours quand le flux standard n'est pas joignable (ICSee et similaires). */
  dvripMode: boolean

  discoveryResults: DiscoveredCamera[]
  discovering: boolean
  refreshing: boolean
  verifying: boolean
  creating: boolean

  /** Resultat de la derniere verification du brouillon ; toute edition l'invalide. */
  verification: { connected: boolean; guidance: string | null } | null

  message: string | null
  error: string | null
  confirmScan: boolean
}

export function buildInitialAddCameraUido(): AddCameraUido {
  return {
    selection: { kind: 'manual' },
    form: emptyCameraDraft,
    dvripMode: false,

    discoveryResults: [],
    discovering: false,
    refreshing: false,
    verifying: false,
    creating: false,

    verification: null,

    message: null,
    error: null,
    confirmScan: false,
  }
}
