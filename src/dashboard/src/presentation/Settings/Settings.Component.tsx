import { Link, Outlet, useLocation } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../common/ui/utils'
import { SETTINGS_RUBRICS, SETTINGS_ROOT, rubricPath } from './settings.rubrics'

/**
 * Coquille des reglages (ADR-40) : premier niveau = les rubriques, second =
 * les pages de chacune.
 *
 * Concue pour le petit ecran d'abord : **un seul niveau est visible a la fois**,
 * liste puis page, avec un retour explicite. Le grand ecran developpe cette
 * meme structure en deux colonnes — il ne la remplace pas, ce qui evite d'avoir
 * deux architectures de navigation a maintenir.
 */
export function SettingsView() {
  const location = useLocation()
  const atRoot = location.pathname.replace(/\/$/, '') === SETTINGS_ROOT
  const current = SETTINGS_RUBRICS.find((rubric) =>
    location.pathname.startsWith(rubricPath(rubric.slug)),
  )

  return (
    <main className="py-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
        <nav
          aria-label="Rubriques de réglages"
          className={cn(
            'rounded-card bg-card text-card-foreground shadow-[var(--shadow-soft)] p-2',
            // Sur mobile la liste cede la place a la page ouverte.
            atRoot ? 'block' : 'hidden md:block',
          )}
        >
          <h1 className="px-3 pt-2 pb-3 font-serif text-2xl">Réglages</h1>
          <ul className="flex flex-col gap-0.5">
            {SETTINGS_RUBRICS.map((rubric) => {
              const active = current?.slug === rubric.slug
              return (
                <li key={rubric.slug}>
                  <Link
                    to={rubricPath(rubric.slug)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg px-3 py-2.5',
                      'transition-colors hover:bg-muted',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      active && 'bg-muted font-semibold',
                    )}
                  >
                    {/* Deux niveaux distingues par trois signaux a la fois —
                        taille, graisse et couleur. Un seul ne suffit pas :
                        c'est ce qui rendait les deux lignes indistinctes. */}
                    <span className="min-w-0">
                      <span className="block font-medium">{rubric.label}</span>
                      <span className="block text-sm text-muted-foreground">{rubric.summary}</span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground md:hidden"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={cn('min-w-0', atRoot ? 'hidden md:block' : 'block')}>
          {current && (
            <Link
              to={SETTINGS_ROOT}
              className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Réglages
            </Link>
          )}

          {atRoot ? (
            <p className="hidden md:block rounded-card bg-card p-6 text-muted-foreground shadow-[var(--shadow-soft)]">
              Choisissez une rubrique.
            </p>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </main>
  )
}
