import { useEffect, useReducer } from 'react'
import { Plus, UserRound } from 'lucide-react'
import { ReadFailure } from '../../common/components/error_message'
import { GroupedList, GroupedRow } from '../../common/components/grouped_list'
import { SettingsPage } from '../../common/settings/settings_page'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { ProfileAlertMode } from '../../domain/entities/profile.entity'
import { ALERT_MODE_LABELS } from './person_labels'
import { buildPersonListPresenter } from './person_list.presenter'
import { personListReducer } from './person_list.reducer'
import { buildInitialPersonListUido } from './person_list.uido'
import { Loading } from '../../common/components/loading'
import { EmptyState } from '../../common/components/empty_state'

// Notifying is the usual case: only a person kept quiet says so (UI-31).
const ALERT_MODE_EXCEPTION: Record<ProfileAlertMode, string | undefined> = {
  always: undefined,
  never: ALERT_MODE_LABELS.never,
}

/** First level of the Persons rubric: the list (UI-25). Adding is its own task/page. */
export function PersonListView() {
  const { profiles: container } = useAppContainer()
  const [uido, dispatch] = useReducer(personListReducer, undefined, buildInitialPersonListUido)
  const presenter = usePresenter(buildPersonListPresenter, { container, dispatch })

  useEffect(() => {
    presenter.onLoad()
  }, [presenter])

  return (
    <SettingsPage lede="Les personnes que Vyzio reconnaît, et ce qu’il en fait.">
      {uido.error && (
        // An unread list is not an empty one: "nobody yet" would be false.
        <ReadFailure
          error={uido.error}
          onRetry={presenter.onLoad}
          subject="La liste des personnes n’a pas pu être lue."
        />
      )}
      {uido.loading && uido.people.length === 0 && !uido.error ? (
        <Loading />
      ) : (
        <>
          {uido.people.length === 0 && !uido.error && (
            <EmptyState>Personne d’enregistrée pour l’instant.</EmptyState>
          )}
          {/* Adding someone never duplicates anyone: it stays offered even when the list is unread. */}
          <GroupedList>
            {uido.people.map((person) => (
              <GroupedRow
                key={person.id}
                to={`/settings/detection/people/${person.id}`}
                icon={UserRound}
                title={person.name}
                subtitle={ALERT_MODE_EXCEPTION[person.alertMode]}
              />
            ))}
            <GroupedRow
              to="/settings/detection/people/add"
              icon={Plus}
              title="Ajouter une personne"
              trailing="none"
            />
          </GroupedList>
        </>
      )}
    </SettingsPage>
  )
}
