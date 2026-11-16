/** The day the Détections page is narrowed to (HIST-03); `day` is a chosen one, as `AAAA-MM-JJ`. */
export type DayFilter =
  | { kind: 'any' }
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'week' }
  | { kind: 'day'; day: string }

export type DayKind = DayFilter['kind']

export const ANY_DAY: DayFilter = { kind: 'any' }

/** Each choice of the sheet's day group, by its row title. */
export const DAY_TITLE: Record<DayKind, string> = {
  any: 'Tous les jours',
  today: 'Aujourd’hui',
  yesterday: 'Hier',
  week: '7 derniers jours',
  day: 'Un autre jour',
}

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

/** Midnight of the day `offset` days after `date`, in the hours of the device that consults. */
function midnight(date: Date, offset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)
}

function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/** A date as a date field holds it, `AAAA-MM-JJ`. */
export function fieldDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The moments the history is read between: a day runs from its midnight to the next one. */
export function dayRange(filter: DayFilter, now: Date): { from?: string; to?: string } {
  switch (filter.kind) {
    case 'any':
      return {}
    case 'today':
      return { from: midnight(now).toISOString() }
    case 'yesterday':
      return { from: midnight(now, -1).toISOString(), to: midnight(now).toISOString() }
    case 'week':
      return { from: midnight(now, -6).toISOString() }
    case 'day': {
      const day = parseDay(filter.day)
      return { from: day.toISOString(), to: midnight(day, 1).toISOString() }
    }
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

/** How the active filter line names the day; nothing when every day is shown. */
export function dayLabel(filter: DayFilter): string | null {
  switch (filter.kind) {
    case 'any':
      return null
    case 'day':
      return DAY_FORMAT.format(parseDay(filter.day))
    default:
      return DAY_TITLE[filter.kind]
  }
}
