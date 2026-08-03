import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../common/ui/select'

/** "Any" is a real value for the dropdown, since empty isn't one; never leaks past this file. */
export const ALL = '__all__'
export const UNKNOWN = '__unknown__'

interface PickOneOption {
  value: string
  label: string
}

export function PickOne({
  value,
  options,
  anyLabel,
  anyValue = ALL,
  onChange,
}: {
  value: string
  options: PickOneOption[]
  anyLabel: string
  anyValue?: string
  onChange: (value: string) => void
}) {
  return (
    <Select
      value={value || anyValue}
      onValueChange={(picked) => onChange(picked === anyValue ? '' : picked)}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={anyValue}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
