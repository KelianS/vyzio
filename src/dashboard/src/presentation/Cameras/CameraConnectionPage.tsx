import { useOutletContext } from 'react-router'
import type { Camera } from '../../domain/entities/Camera'
import { SettingsPanel } from '../Settings/SettingsPanel'
import { CapabilitySection } from './CapabilitySection'

/**
 * Connexion et capacites de la camera.
 *
 * `CapabilitySection` n'est pas encore reprise : elle garde ses propres boutons
 * et ses enregistrements immediats, au lieu du cycle en deux temps d'ADR-41.
 * Elle est **rangee** au bon endroit avant d'etre reecrite.
 */
export function CameraConnectionPage() {
  const camera = useOutletContext<Camera>()

  return (
    <SettingsPanel
      title="Connexion"
      lede="Comment Vyzio joint cette caméra, et ce dont elle est capable."
    >
      <CapabilitySection camera={camera} />
    </SettingsPanel>
  )
}
