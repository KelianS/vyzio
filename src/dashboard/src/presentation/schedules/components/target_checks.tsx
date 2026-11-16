import { GroupedItem, GroupedList } from '../../../common/components/grouped_list'
import { Checkbox } from '../../../common/ui/checkbox'

/** What a range aims at, as checked rows of one grouped list (SCHED-10). */
export function TargetChecks({
  label,
  options,
  checked,
  empty,
  onToggle,
}: {
  label: string
  options: readonly { value: string; label: string }[]
  checked: readonly string[]
  /** Said in place of the rows when there is nothing to aim at. */
  empty: string
  onToggle: (value: string) => void
}) {
  return (
    <GroupedList label={label}>
      {options.length === 0 ? (
        <li className="px-4 py-4 text-body text-muted-foreground">{empty}</li>
      ) : (
        options.map((option) => (
          <GroupedItem key={option.value}>
            <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-row font-medium">
              {option.label}
              <Checkbox
                checked={checked.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
                className="size-5.5"
              />
            </label>
          </GroupedItem>
        ))
      )}
    </GroupedList>
  )
}
