import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { useAsync } from '../../common/hooks/useAsync'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { ALERT_MODE_LABELS, CATEGORY_LABELS } from './personLabels'

/**
 * Premier niveau de la rubrique Personnes : **la liste** (ADR-40).
 *
 * Ajouter quelqu'un est une tache distincte, avec sa propre page — le
 * formulaire de creation occupait jusqu'ici le meme panneau que la fiche, si
 * bien qu'on ne savait pas toujours si l'on creait ou si l'on modifiait.
 */
export function PersonListPage() {
  const { profiles: container } = useAppContainer()
  const people = useAsync(() => container.getProfiles.execute(), [])

  return (
    <SettingsPage lede="Les personnes que Vyzio reconnaît, et ce qu’il en fait.">
      {people.data && people.data.length > 0 ? (
        <ul className="divide-y divide-border">
          {people.data.map((person) => (
            <li key={person.id}>
              <Link
                to={`/settings/detection/personnes/${person.id}`}
                className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{person.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {CATEGORY_LABELS[person.category]} · {ALERT_MODE_LABELS[person.alertMode]}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-muted-foreground">
          {people.loading ? 'Chargement…' : 'Personne d’enregistrée pour l’instant.'}
        </p>
      )}

      <div className="mt-5">
        <Button asChild>
          <Link to="/settings/detection/personnes/ajout">
            <Plus aria-hidden="true" />
            Ajouter une personne
          </Link>
        </Button>
      </div>
    </SettingsPage>
  )
}
