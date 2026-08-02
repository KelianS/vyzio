import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { RecordingSettingsSection } from '../Cameras/RecordingSettingsSection'
import { SettingsPanel } from './SettingsPanel'

/**
 * Durees de conservation de l'installation (ADR-39).
 *
 * Elles vivaient jusqu'ici dans la barre laterale de l'ecran Cameras, entre la
 * saisie manuelle et la liste des candidats — faute d'endroit correct ou les
 * mettre. C'est cette page qui leur en donne un.
 */
export function ConservationPage() {
  // Ces cas d'usage vivent encore dans le container « cameras », heritage de
  // l'endroit ou la section etait affichee. Ils rejoindront un container propre
  // a la reprise des ecrans de reglages ; ce n'est pas le sujet de la coquille.
  const { cameras: container } = useAppContainer()

  return (
    <SettingsPanel title="Conservation">
      <RecordingSettingsSection
        getRecordingSettings={container.getRecordingSettings}
        saveRecordingSettings={container.saveRecordingSettings}
      />
    </SettingsPanel>
  )
}
