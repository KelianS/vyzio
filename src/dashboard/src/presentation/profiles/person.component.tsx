import { useEffect, useReducer } from 'react'
import { Link, Outlet, useMatches, useParams } from 'react-router'
import { TabBar } from '../../common/components/tab_bar'
import { ReadFailure } from '../../common/components/error_message'
import { SettingsPage } from '../../common/settings/settings_page'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { PersonContext } from './person_context'
import { PageHeader } from '../../common/components/page_header'
import { buildPersonPresenter } from './person.presenter'
import { personReducer } from './person.reducer'
import { buildInitialPersonUido } from './person.uido'
import { Loading } from '../../common/components/loading'
import { isSubPage } from '../settings/settings.rubrics'
import { PEOPLE_PATH } from '../settings/settings.rubrics'

const PERSON_PAGES = [
  { slug: 'identity', label: 'Identité' },
  { slug: 'photos', label: 'Photos' },
  { slug: 'cameras', label: 'Caméras' },
]

/** The pages of one person, mirroring the camera shell. */
export function PersonView() {
  const { profileId } = useParams()
  const { profiles: container } = useAppContainer()
  const [uido, dispatch] = useReducer(personReducer, undefined, buildInitialPersonUido)
  const presenter = usePresenter(buildPersonPresenter, { container, dispatch })
  const subPage = isSubPage(useMatches())

  useEffect(() => {
    presenter.onLoad(profileId!)
  }, [presenter, profileId])

  const found = uido.person

  if (uido.loading)
    return (
      <SettingsPage>
        <Loading />
      </SettingsPage>
    )

  // An unread list says nothing about this person: "not found" would be a false answer.
  if (uido.error) {
    return (
      <SettingsPage>
        <h1 className="text-title">Cette personne ne s’affiche pas</h1>
        <ReadFailure
          error={uido.error}
          onRetry={() => presenter.onLoad(profileId!)}
          className="mt-3"
        />
        <Link to={PEOPLE_PATH} className="mt-3 inline-block underline underline-offset-2">
          Revenir à la liste
        </Link>
      </SettingsPage>
    )
  }

  if (!found) {
    return (
      // This route owns its header; with no person to name, it must do so itself.
      <SettingsPage>
        <h1 className="text-title">Personne introuvable</h1>
        <Link to={PEOPLE_PATH} className="mt-3 inline-block underline underline-offset-2">
          Revenir à la liste
        </Link>
      </SettingsPage>
    )
  }

  const context = {
    person: found,
    reload: () => presenter.onLoad(profileId!),
  } satisfies PersonContext

  // A sub-page names itself and leads back to its tab: neither the person's name nor the tabs.
  if (subPage) return <Outlet context={context} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={found.name} />

      <TabBar
        label="Réglages de la personne"
        tabs={PERSON_PAGES.map((page) => ({
          to: `${PEOPLE_PATH}/${found.id}/${page.slug}`,
          label: page.label,
        }))}
      >
        <Outlet context={context} />
      </TabBar>
    </div>
  )
}
