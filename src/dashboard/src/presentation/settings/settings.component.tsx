import { Outlet, useLocation, useMatches } from 'react-router'
import { cn } from '../../common/ui/utils'
import {
  SETTINGS_RUBRICS,
  SETTINGS_ROOT,
  SETTINGS_SECTIONS,
  declaresOwnHeader,
  rubricPath,
} from './settings.rubrics'
import { GroupedList, GroupedRow } from '../../common/components/grouped_list'
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
        <nav
          aria-label="Rubriques de réglages"
          className={cn('flex-col gap-6', atRoot ? 'flex' : 'hidden md:flex')}
        >
          {SETTINGS_SECTIONS.map((section) => (
            <GroupedList key={section} label={section}>
              {SETTINGS_RUBRICS.filter((rubric) => rubric.section === section).map((rubric) => (
                <GroupedRow
                  key={rubric.slug}
                  to={rubricPath(rubric.slug)}
                  icon={rubric.icon}
                  title={rubric.label}
                  current={current?.slug === rubric.slug}
                />
              ))}
            </GroupedList>
          ))}
        </nav>

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
