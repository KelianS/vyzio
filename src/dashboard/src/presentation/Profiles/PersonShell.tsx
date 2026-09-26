import { Link, Outlet, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { TabBar } from '../../common/components/TabBar'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { useAsync } from '../../common/hooks/useAsync'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { CATEGORY_LABELS } from './personLabels'

const PERSON_PAGES = [
  { slug: 'identite', label: 'Identité' },
  { slug: 'photos', label: 'Photos' },
  { slug: 'cameras', label: 'Caméras' },
]

/** Third level: pages of one person (ADR-40), mirroring the camera shell. */
export function PersonShell() {
  const { profileId } = useParams()
  const { profiles: container } = useAppContainer()
  const person = useAsync(() => container.getProfiles.execute(), [])
  const found = person.data?.find((entry) => entry.id === profileId) ?? null

  if (person.loading) return <SettingsPage>Chargement…</SettingsPage>

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

      <Outlet context={{ person: found, reload: person.reload }} />
    </div>
  )
}
