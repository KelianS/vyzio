import { useEffect, useReducer } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { ReadFailure } from '../../common/components/error_message'
import { SettingsPage } from '../../common/settings/settings_page'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { ALERT_MODE_LABELS, CATEGORY_LABELS } from './person_labels'
import { buildPersonListPresenter } from './person_list.presenter'
import { personListReducer } from './person_list.reducer'
import { buildInitialPersonListUido } from './person_list.uido'

/** First level of the Persons rubric: the list (ADR-40). Adding is its own task/page. */
export function PersonListView() {
  const { profiles: container } = useAppContainer()
  const [uido, dispatch] = useReducer(personListReducer, undefined, buildInitialPersonListUido)
  const presenter = usePresenter(buildPersonListPresenter, { container, dispatch })

  useEffect(() => {
    presenter.onLoad()
  }, [presenter])

  return (
    <SettingsPage lede="Les personnes que Vyzio reconnaît, et ce qu’il en fait.">
      {uido.error ? (
        // An unread list is not an empty one: "nobody yet" would be false.
        <ReadFailure error={uido.error} onRetry={presenter.onLoad} className="py-3" />
      ) : uido.people.length > 0 ? (
        <ul className="divide-y divide-border">
          {uido.people.map((person) => (
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
          {uido.loading ? 'Chargement…' : 'Personne d’enregistrée pour l’instant.'}
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
