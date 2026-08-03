import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { SettingsPage } from '../../common/settings/SettingsPage'

/** System settings with the "Advanced" fold (ADR-40): the engine's technical UI stays a fallback, not a front-row path (principle #2). */
export function SystemPage() {
  return (
    <SettingsPage lede="Ressources de la machine et réglages rarement nécessaires.">
      <p className="text-sm text-muted-foreground">
        L’état du stockage et des ressources est visible depuis l’accueil. Les seuils d’alerte
        arriveront ici.
      </p>

      <details className="mt-6 rounded-inset border border-border">
        <summary className="cursor-pointer rounded-inset px-4 py-3 font-medium select-none hover:bg-muted">
          Avancé
        </summary>
        <div className="border-t border-border px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Une interface technique donne accès au détail brut de la surveillance. Elle n’est pas
            nécessaire à l’usage courant, et ce qu’on y modifie n’est pas repris par Vyzio.
          </p>
          <Link
            to="/settings/systeme/avance"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Ouvrir l’interface technique
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </details>
    </SettingsPage>
  )
}
