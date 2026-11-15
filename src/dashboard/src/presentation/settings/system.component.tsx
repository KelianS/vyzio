import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { SettingsPage } from '../../common/settings/settings_page'
import { AdvancedFold } from '../../common/settings/advanced_fold'
import { Button } from '../../common/ui/button'

/** System settings with the "Advanced" fold (UI-09): the engine's technical UI stays a fallback, not a front-row path (principle #2). */
export function SystemView() {
  return (
    <SettingsPage lede="L’état du stockage et des ressources est visible depuis l’accueil.">
      <AdvancedFold lede="Une interface technique donne accès au détail brut de la surveillance. Elle n’est pas nécessaire à l’usage courant, et ce qu’on y modifie n’est pas repris par Vyzio.">
        <Button asChild variant="secondary">
          <Link to="/settings/systeme/avance">
            Ouvrir l’interface technique
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      </AdvancedFold>
    </SettingsPage>
  )
}
