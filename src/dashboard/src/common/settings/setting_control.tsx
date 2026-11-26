import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Switch } from '../ui/switch'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import { Slider } from '../ui/slider'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '../ui/utils'
import {
  VISIBLE_CHOICES_MAX,
  type SettingDeclaration,
  type SettingNature,
} from './setting_declaration'
import { SECRET_KEYBOARD, TEXT_KEYBOARD } from './text_keyboard'
import { EmptyState } from '../components/empty_state'
import { SecretInput } from '../components/secret_input'

/** Nature -> control (ADR-15): the only place this choice is made. */
export function SettingControl({ setting }: { setting: SettingDeclaration }) {
  const { nature } = setting

  switch (nature.kind) {
    case 'toggle':
      return <ToggleControl setting={setting} />
    case 'choice':
      return <DropdownControl setting={setting} nature={nature} />
    case 'multiChoice':
      return <MultiChoiceControl setting={setting} nature={nature} />
    case 'number':
      return <NumberControl setting={setting} nature={nature} />
    case 'range':
      return <RangeControl setting={setting} nature={nature} />
    case 'time':
      return <TimeControl setting={setting} />
    case 'text':
      return <TextControl setting={setting} nature={nature} />
    case 'secret':
      return <SecretControl setting={setting} nature={nature} />
    default: {
      // Exhaustiveness: a new nature without its control fails to compile.
      const exhaustive: never = nature
      return exhaustive
    }
  }
}

function ToggleControl({ setting }: { setting: SettingDeclaration }) {
  return (
    <Switch
      id={setting.id}
      checked={setting.value === true}
      disabled={setting.disabled}
      onCheckedChange={(checked) => setting.onChange(checked)}
    />
  )
}

type Narrow<K extends SettingNature['kind']> = Extract<SettingNature, { kind: K }>

function DropdownControl({
  setting,
  nature,
}: {
  setting: SettingDeclaration
  nature: Narrow<'choice'>
}) {
  return (
    <Select
      value={String(setting.value)}
      disabled={setting.disabled}
      onValueChange={(value) => setting.onChange(value)}
    >
      <SelectTrigger id={setting.id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {nature.options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={!!option.unavailable}
            // Greyed by its colour, not the primitive's fade, so the reason stays readable.
            className={cn(
              option.unavailable && 'text-muted-foreground data-[disabled]:opacity-100',
            )}
          >
            <span className="flex flex-col items-start gap-0.5">
              {option.label}
              {option.unavailable && <span className="text-label">{option.unavailable}</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The multiple choice opens like a select, so it is drawn as a field, never as a button. */
const FIELD_TRIGGER =
  'h-13 w-full justify-between rounded-md border border-input bg-card px-4 font-normal text-foreground hover:bg-card'

function MultiChoiceControl({
  setting,
  nature,
}: {
  setting: SettingDeclaration
  nature: Narrow<'multiChoice'>
}) {
  const selected = Array.isArray(setting.value) ? (setting.value as string[]) : []
  const searchable = nature.options.length > VISIBLE_CHOICES_MAX
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    if (!searchable || query.trim() === '') return nature.options
    const needle = query.trim().toLowerCase()
    return nature.options.filter((option) => option.label.toLowerCase().includes(needle))
  }, [nature.options, query, searchable])

  function toggle(value: string, checked: boolean) {
    setting.onChange(checked ? [...selected, value] : selected.filter((entry) => entry !== value))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={setting.id}
          type="button"
          variant="ghost"
          role="combobox"
          disabled={setting.disabled}
          className={FIELD_TRIGGER}
        >
          {/* Un reglage se lit au repos : le controle dit son etat, pas la liste des options. */}
          <span className="truncate">
            {summarise(nature.options, selected, nature.emptySummary)}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      {/* Aucune validation propre : chaque case va au brouillon, que la barre enregistre (ADR-15). */}
      <PopoverContent
        align="start"
        className="flex w-[var(--radix-popover-trigger-width)] flex-col gap-2 p-2"
      >
        {searchable && (
          <Input
            aria-label={`Filtrer ${setting.label.toLowerCase()}`}
            placeholder="Filtrer…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        <div
          role="group"
          aria-labelledby={`${setting.id}-label`}
          className="flex max-h-64 flex-col gap-1.5 overflow-y-auto"
        >
          {visible.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-body hover:bg-secondary"
            >
              <Checkbox
                checked={selected.includes(option.value)}
                disabled={setting.disabled}
                onCheckedChange={(checked) => toggle(option.value, checked === true)}
              />
              {option.label}
            </label>
          ))}
          {visible.length === 0 && <EmptyState>Aucun résultat.</EmptyState>}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Beyond that, the summary would vary in width, and the control column with it. */
const SUMMARY_NAMES_MAX = 2

/** The state of a multiple choice in one line: two names at most, then the count of the rest. */
function summarise(
  options: Narrow<'multiChoice'>['options'],
  selected: string[],
  emptySummary?: string,
): string {
  const chosen = options.filter((option) => selected.includes(option.value))
  if (chosen.length === 0) return emptySummary ?? 'Aucune sélection'
  // Where empty already means everything, a full choice is a list and names its items.
  if (chosen.length === options.length && emptySummary === undefined) return 'Tout'

  const named = chosen
    .slice(0, SUMMARY_NAMES_MAX)
    .map((option) => option.label)
    .join(', ')

  const rest = chosen.length - SUMMARY_NAMES_MAX
  return rest > 0 ? `${named} +${rest}` : named
}

function NumberControl({
  setting,
  nature,
}: {
  setting: SettingDeclaration
  nature: Narrow<'number'>
}) {
  // Free typing while focused; otherwise "30" would fire "3" first and jump under the cursor.
  const [typed, setTyped] = useState<string | null>(null)
  const min = nature.min ?? 0
  const max = nature.max

  function commit() {
    if (typed === null) return
    const parsed = Number.parseInt(typed, 10)
    setTyped(null)
    if (Number.isNaN(parsed)) return
    const clamped = Math.max(min, max === undefined ? parsed : Math.min(max, parsed))
    if (clamped !== setting.value) setting.onChange(clamped)
  }

  return (
    // Sized to its value and starting at the column's edge, so the anatomy stays aligned (ADR-15).
    <div
      className={cn(
        'flex h-11 w-fit min-w-26 items-center rounded-md border border-input bg-card shadow-xs',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        setting.disabled && 'opacity-50',
      )}
    >
      <Input
        id={setting.id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        disabled={setting.disabled}
        className={cn(
          // Over the whole height and at least a finger wide: the field itself is the tap target.
          'h-11 w-0 min-w-11 flex-1 rounded-none border-0 bg-transparent py-0 pl-3 text-right tabular-nums shadow-none',
          nature.unit ? 'pr-0' : 'pr-3',
          'focus-visible:ring-0 disabled:opacity-100',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        )}
        value={typed ?? String(setting.value)}
        onChange={(event) => setTyped(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {/* L'unite appartient a la valeur, jamais au libelle. */}
      {nature.unit && (
        <span className="pointer-events-none shrink-0 pr-3 pl-1 text-body text-muted-foreground">
          {nature.unit}
        </span>
      )}
    </div>
  )
}

function RangeControl({
  setting,
  nature,
}: {
  setting: SettingDeclaration
  nature: Narrow<'range'>
}) {
  const current = typeof setting.value === 'number' ? setting.value : nature.min

  return (
    <div className="flex w-full items-center gap-3">
      <Slider
        id={setting.id}
        aria-labelledby={`${setting.id}-label`}
        className="min-w-32 flex-1"
        min={nature.min}
        max={nature.max}
        step={nature.step ?? 1}
        disabled={setting.disabled}
        value={[current]}
        onValueChange={([value]) => setting.onChange(value)}
      />
      {/* Un curseur seul empeche de viser et de se relire. */}
      <span className="w-16 shrink-0 text-right text-body tabular-nums">
        {current} {nature.unit}
      </span>
    </div>
  )
}

function TimeControl({ setting }: { setting: SettingDeclaration }) {
  return (
    <Input
      id={setting.id}
      type="time"
      className="w-full tabular-nums"
      disabled={setting.disabled}
      value={String(setting.value ?? '')}
      onChange={(event) => setting.onChange(event.target.value)}
    />
  )
}

function TextControl({ setting, nature }: { setting: SettingDeclaration; nature: Narrow<'text'> }) {
  return (
    <Input
      {...TEXT_KEYBOARD[nature.keyboard ?? 'prose']}
      id={setting.id}
      className="w-full"
      placeholder={nature.placeholder}
      disabled={setting.disabled}
      value={String(setting.value ?? '')}
      onChange={(event) => setting.onChange(event.target.value)}
    />
  )
}

function SecretControl({
  setting,
  nature,
}: {
  setting: SettingDeclaration
  nature: Narrow<'secret'>
}) {
  return (
    <SecretInput
      {...SECRET_KEYBOARD}
      id={setting.id}
      label={setting.label}
      placeholder={nature.placeholder}
      validating={nature.validating}
      disabled={setting.disabled}
      value={String(setting.value ?? '')}
      onChange={(event) => setting.onChange(event.target.value)}
    />
  )
}
