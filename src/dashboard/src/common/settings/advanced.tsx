import type { ReactNode } from 'react'
import { GroupedList, GroupedRow } from '../components/grouped_list'
import { PageHeader } from '../components/page_header'
import { SettingsPage } from './settings_page'

const ADVANCED = 'Avancé'

/** `Avancé` is a position, not a mode (UI-09): one row at the end of the settings, the same everywhere, opening its own page. */
export function AdvancedRow({ to, subtitle }: { to: string; subtitle?: string }) {
  return (
    <GroupedList>
      <GroupedRow to={to} title={ADVANCED} subtitle={subtitle} weight="action" />
    </GroupedList>
  )
}

/** The page `Avancé` opens: named in the bar, the back button returning to the page it left. */
export function AdvancedPage({ lede, children }: { lede?: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={ADVANCED} />
      <SettingsPage lede={lede}>{children}</SettingsPage>
    </>
  )
}
