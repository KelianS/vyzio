import { Link, Outlet, useLocation, useMatches } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../common/ui/utils'
import { SETTINGS_RUBRICS, SETTINGS_ROOT, declaresOwnHeader, rubricPath } from './settings.rubrics'
import { ListRow } from '../../common/components/list_row'
import { PageHeader } from '../../common/components/page_header'
import { Surface } from '../../common/components/surface'

/**
 * The settings shell (UI-25): first level = the sections, second = the pages of
 * each one.
 *
 * Designed for the small screen first: **one level is visible at a time**, list
 * then page, the bar's back button the way out. The large screen unfolds that
 * same structure into two columns - it does not replace it, which avoids keeping
 * two navigation architectures alive.
 */
export function SettingsView() {
  const location = useLocation()
  const atRoot = location.pathname.replace(/\/$/, '') === SETTINGS_ROOT
  const current = SETTINGS_RUBRICS.find((rubric) =>
    location.pathname.startsWith(rubricPath(rubric.slug)),
  )
  const matches = useMatches()
  const showRubricTitle = current !== undefined && !declaresOwnHeader(matches)

  return (
    <main>
      {atRoot && <PageHeader title="Réglages" />}
      {showRubricTitle && <PageHeader title={current.label} />}

      <div className="grid gap-4 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
        {/* On mobile the list gives way to the open page. */}
        <div className={atRoot ? 'block' : 'hidden md:block'}>
          <Surface inset="list" asChild>
            <nav aria-label="Rubriques de réglages">
              <ul className="flex flex-col gap-0.5">
                {SETTINGS_RUBRICS.map((rubric) => {
                  const active = current?.slug === rubric.slug
                  return (
                    <li key={rubric.slug}>
                      <ListRow
                        className={cn(
                          'rounded-full px-4 py-2.5',
                          active && 'bg-secondary font-semibold',
                        )}
                      >
                        <Link
                          to={rubricPath(rubric.slug)}
                          aria-current={active ? 'page' : undefined}
                        >
                          {/* Size, weight and colour together: one signal alone left the two lines alike. */}
                          <span className="min-w-0">
                            <span className="block text-row font-semibold">{rubric.label}</span>
                            <span className="block text-body text-muted-foreground">
                              {rubric.summary}
                            </span>
                          </span>
                          <ChevronRight
                            className="size-5 shrink-0 text-muted-foreground md:hidden"
                            aria-hidden="true"
                          />
                        </Link>
                      </ListRow>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </Surface>
        </div>

        <div className={cn('min-w-0', atRoot ? 'hidden md:block' : 'block')}>
          {atRoot ? (
            <Surface asChild className="hidden text-muted-foreground md:block">
              <p>Choisissez une rubrique.</p>
            </Surface>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </main>
  )
}
