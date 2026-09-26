import { useEffect, useReducer } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { TabBar } from '../../common/components/tab_bar'
import { SettingsPage } from '../../common/settings/settings_page'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { PersonContext } from './person_context'
import { CATEGORY_LABELS } from './person_labels'
import { buildPersonPresenter } from './person.presenter'
import { personReducer } from './person.reducer'
import { buildInitialPersonUido } from './person.uido'

const PERSON_PAGES = [
  { slug: 'identite', label: 'Identité' },
  { slug: 'photos', label: 'Photos' },
  { slug: 'cameras', label: 'Caméras' },
]

/** Third level: pages of one person (ADR-40), mirroring the camera shell. */
export function PersonView() {
  const { profileId } = useParams()
  const { profiles: container } = useAppContainer()
  const [uido, dispatch] = useReducer(personReducer, undefined, buildInitialPersonUido)
  const presenter = usePresenter(buildPersonPresenter, { container, dispatch })

  useEffect(() => {
    presenter.onLoad(profileId!)
  }, [presenter, profileId])

  const found = uido.person

  if (uido.loading) return <SettingsPage>Chargement…</SettingsPage>

  if (!found) {
    return (
      // This route owns its header; with no person to name, it must do so itself.
      <SettingsPage>
        <h1 className="font-serif text-3xl">Personne introuvable</h1>
        <Link
          to="/settings/detection/personnes"
          className="mt-3 inline-block underline underline-offset-2"
        >
          Revenir à la liste
        </Link>
      </SettingsPage>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to="/settings/detection/personnes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Personnes
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-serif text-3xl">{found.name}</h1>
          <span className="text-sm text-muted-foreground">{CATEGORY_LABELS[found.category]}</span>
        </div>
      </div>

      <TabBar
        label="Réglages de la personne"
        tabs={PERSON_PAGES.map((page) => ({
          to: `/settings/detection/personnes/${found.id}/${page.slug}`,
          label: page.label,
        }))}
      />

      <Outlet
        context={
          { person: found, reload: () => presenter.onLoad(profileId!) } satisfies PersonContext
        }
      />
    </div>
  )
}
