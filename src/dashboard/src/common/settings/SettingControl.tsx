import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Switch } from '../ui/switch'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import { Slider } from '../ui/slider'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { cn } from '../ui/utils'
import {
  VISIBLE_CHOICES_MAX,
  type SettingDeclaration,
  type SettingNature,
} from './settingDeclaration'

/** Nature -> control (ADR-43): the only place this choice is made. */
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

/** Dims the value while it's inherited from the level above (ADR-39). */
function followingClass(setting: SettingDeclaration) {
  return setting.provenance?.following ? 'text-muted-foreground' : undefined
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
      <SelectTrigger id={setting.id} className={cn('w-full', followingClass(setting))}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {nature.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

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
    <div className="flex w-full flex-col gap-2">
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
        className={cn(
          'flex flex-col gap-1.5',
          searchable && 'max-h-56 overflow-y-auto rounded-lg border border-border p-2',
        )}
      >
        {visible.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(option.value)}
              disabled={setting.disabled}
              onCheckedChange={(checked) => toggle(option.value, checked === true)}
            />
            {option.label}
          </label>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">Aucun résultat.</p>}
      </div>
    </div>
  )
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
    <div className="flex items-center gap-2">
      <Input
        id={setting.id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        disabled={setting.disabled}
        className={cn('w-24 text-right tabular-nums', followingClass(setting))}
        value={typed ?? String(setting.value)}
        onChange={(event) => setTyped(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {/* L'unite appartient a la valeur, jamais au libelle. */}
      <span className={cn('text-sm text-muted-foreground')}>{nature.unit}</span>
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
      <span className="w-16 shrink-0 text-right text-sm tabular-nums">
        {current} {nature.unit}
      </span>
    </div>
  )
}

function TextControl({ setting, nature }: { setting: SettingDeclaration; nature: Narrow<'text'> }) {
  return (
    <Input
      id={setting.id}
      className={cn('w-full', followingClass(setting))}
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
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex w-full items-center gap-1">
      <Input
        id={setting.id}
        type={revealed ? 'text' : 'password'}
        className="w-full"
        placeholder={nature.placeholder}
        disabled={setting.disabled}
        value={String(setting.value ?? '')}
        onChange={(event) => setting.onChange(event.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={revealed ? 'Masquer' : 'Afficher'}
        onClick={() => setRevealed((previous) => !previous)}
      >
        {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  )
}
