import { Link, NavLink, Outlet, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../../common/ui/utils'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { useAsync } from '../../common/hooks/useAsync'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { CATEGORY_LABELS } from './personLabels'

const PERSON_PAGES = [
  { slug: 'identite', label: 'Identité' },
  { slug: 'photos', label: 'Photos' },
  { slug: 'cameras', label: 'Caméras' },
]

/** Troisieme niveau : les pages d'**une** personne (ADR-40), comme pour une camera. */
export function PersonShell() {
  const { profileId } = useParams()
  const { profiles: container } = useAppContainer()
  const person = useAsync(() => container.getProfiles.execute(), [])
  const found = person.data?.find((entry) => entry.id === profileId) ?? null

  if (person.loading) return <SettingsPage>Chargement…</SettingsPage>

  if (!found) {
    return (
      // Cette route annonce porter son propre en-tete : sans personne a nommer,
      // c'est a l'echec de le faire, sinon la page resterait anonyme.
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

      <nav
        aria-label="Réglages de la personne"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {PERSON_PAGES.map((page) => (
          <NavLink
            key={page.slug}
            to={`/settings/detection/personnes/${found.id}/${page.slug}`}
            className={({ isActive }) =>
              cn(
                'shrink-0 rounded-lg px-3 py-2 text-sm transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isActive
                  ? 'bg-card font-medium shadow-xs'
                  : 'text-muted-foreground hover:bg-card/60',
              )
            }
          >
            {page.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ person: found, reload: person.reload }} />
    </div>
  )
}
