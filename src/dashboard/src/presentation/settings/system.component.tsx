import { ChevronRight, Wrench } from 'lucide-react'
import { SettingsPage } from '../../common/settings/settings_page'
import { AdvancedFold } from '../../common/settings/advanced_fold'
import { SecondaryButton } from '../../common/components/secondary_button'

/** System settings with the "Advanced" fold (UI-09): the engine's technical UI stays a fallback, not a front-row path (principle #2). */
export function SystemView() {
  return (
    <SettingsPage lede="L’état du stockage et des ressources est visible depuis l’accueil.">
      <AdvancedFold lede="Une interface technique donne accès au détail brut de la surveillance. Elle n’est pas nécessaire à l’usage courant, et ce qu’on y modifie n’est pas repris par Vyzio.">
        <SecondaryButton icon={Wrench} to="/settings/hardware/advanced">
          Ouvrir l’interface technique
          <ChevronRight aria-hidden="true" />
        </SecondaryButton>
      </AdvancedFold>
    </SettingsPage>
  )
}
