import { Sheet, type SheetOption } from '../../../common/components/sheet'
import { Input } from '../../../common/ui/input'
import { DetectionTypeIcon } from '../../../common/detection/detection_type_icon'
import type { Camera } from '../../../domain/entities/camera.entity'
import type { DetectionLabel } from '../../../domain/entities/detection_label.entity'
import type { Profile } from '../../../domain/entities/profile.entity'
import { DAY_TITLE, fieldDay, type DayFilter, type DayKind } from '../day_filter'
import type { FilterAxis } from '../detection_history.uido'

/** The day choices a tap applies; a chosen day is the field of its own row. */
const QUICK_DAYS: readonly Exclude<DayKind, 'day'>[] = ['any', 'today', 'yesterday', 'week']

/**
 * The filter of the bar (HIST-03): a day, then one group per axis whose rows are checked and
 * unchecked, several at once; the list follows at each tap and the sheet stays open.
 */
export function FilterSheet({
  cameras,
  profiles,
  labels,
  filters,
  day,
  onToggle,
  onClear,
  onDay,
  onClose,
}: {
  cameras: readonly Camera[]
  profiles: readonly Profile[]
  labels: readonly DetectionLabel[]
  filters: Record<FilterAxis, readonly string[]>
  day: DayFilter
  onToggle: (axis: FilterAxis, value: string) => void
  onClear: (axis: FilterAxis) => void
  onDay: (day: DayFilter) => void
  onClose: () => void
}) {
  const axis = (
    name: FilterAxis,
    group: string,
    all: string,
    values: { value: string; title: string; icon?: SheetOption['icon'] }[],
  ): SheetOption[] =>
    values.length === 0
      ? []
      : [
          {
            key: `${name}-all`,
            group,
            title: all,
            selected: filters[name].length === 0,
            onPick: () => onClear(name),
          },
          ...values.map((option) => ({
            key: `${name}-${option.value}`,
            group,
            title: option.title,
            icon: option.icon,
            selected: filters[name].includes(option.value),
            onPick: () => onToggle(name, option.value),
          })),
        ]

  const options: SheetOption[] = [
    ...QUICK_DAYS.map((kind) => ({
      key: `day-${kind}`,
      group: 'Jour',
      title: DAY_TITLE[kind],
      selected: day.kind === kind,
      onPick: () => onDay({ kind }),
    })),
    {
      key: 'day-day',
      group: 'Jour',
      title: DAY_TITLE.day,
      selected: day.kind === 'day',
      field: (
        <Input
          type="date"
          aria-label={DAY_TITLE.day}
          max={fieldDay(new Date())}
          value={day.kind === 'day' ? day.day : ''}
          onChange={(event) => {
            const chosen = event.target.value
            onDay(chosen ? { kind: 'day', day: chosen } : { kind: 'any' })
          }}
          className="w-auto shrink-0"
        />
      ),
    },
    ...axis(
      'camera',
      'Caméra',
      'Toutes les caméras',
      cameras.map((camera) => ({ value: camera.id, title: camera.displayName })),
    ),
    ...axis(
      'profile',
      'Personne',
      'Toutes les personnes',
      profiles.map((profile) => ({ value: profile.id, title: profile.name })),
    ),
    ...axis(
      'label',
      'Type',
      'Tous les types',
      labels.map((known) => ({
        value: known.value,
        title: known.displayName,
        icon: <DetectionTypeIcon label={known.value} />,
      })),
    ),
  ]

  return (
    <Sheet
      title="Filtrer"
      effect="Cochez ce que vous voulez voir : la liste suit à chaque choix."
      options={options}
      checkable
      onClose={onClose}
    />
  )
}
