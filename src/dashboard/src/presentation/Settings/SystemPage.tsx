import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { AdvancedFold } from '../../common/settings/AdvancedFold'

/** System settings with the "Advanced" fold (ADR-40): the engine's technical UI stays a fallback, not a front-row path (principle #2). */
export function SystemPage() {
  return (
    <SettingsPage lede="L’état du stockage et des ressources est visible depuis l’accueil. Les seuils d’alerte arriveront ici.">
      <AdvancedFold lede="Une interface technique donne accès au détail brut de la surveillance. Elle n’est pas nécessaire à l’usage courant, et ce qu’on y modifie n’est pas repris par Vyzio.">
        <Link
          to="/settings/systeme/avance"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Ouvrir l’interface technique
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </AdvancedFold>
    </SettingsPage>
  )
}
