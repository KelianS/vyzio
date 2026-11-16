import { Lock, LockOpen } from 'lucide-react'
import { Button } from '../ui/button'
import { HelpTrigger } from '../components/help_trigger'
import { cn } from '../ui/utils'
import { SettingControl } from './setting_control'
import type { InheritedFrom, SettingDeclaration, SettingNature } from './setting_declaration'

/** Whether the control sits beside the name on a phone: a short control does, a long one goes under it. */
const BESIDE_THE_NAME: Record<SettingNature['kind'], boolean> = {
  toggle: true,
  number: true,
  choice: false,
  multiChoice: false,
  range: false,
  time: false,
  text: false,
  secret: false,
}

/** Five no-break spaces: the width of the help icon and its gap, at the name's size. */
const HELP_ROOM = String.fromCharCode(0xa0).repeat(5)

/** What a lock says, by the level the value is inherited from. */
const INHERITED_FROM: Record<InheritedFrom, { mark: string; revert: string }> = {
  installation: {
    mark: 'Valeur de l’ensemble',
    revert: 'Revenir à la valeur de l’ensemble',
  },
  default: { mark: 'Valeur par défaut', revert: 'Revenir à la valeur par défaut' },
}

/** On a phone, the lock takes a column of its own beside the control, whichever row that is. */
const PHONE_COLUMNS = {
  beside: {
    locked: 'grid-cols-[minmax(0,1fr)_auto_auto]',
    plain: 'grid-cols-[minmax(0,1fr)_auto]',
  },
  under: { locked: 'grid-cols-[minmax(0,1fr)_auto]', plain: 'grid-cols-1' },
} as const

/** Fixed row anatomy (ADR-15): label · help · control · lock, control column shared app-wide. */
export function SettingRow({ setting }: { setting: SettingDeclaration }) {
  const { inherits } = setting
  const beside = BESIDE_THE_NAME[setting.nature.kind]

  return (
    <div
      className={cn(
        'grid min-h-14 items-center gap-x-4 gap-y-2',
        PHONE_COLUMNS[beside ? 'beside' : 'under'][inherits ? 'locked' : 'plain'],
        beside ? 'py-2.5' : 'py-3.5',
        // The lock column stays reserved, so rows line up whether a setting inherits or not.
        'sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_2.75rem]',
      )}
    >
      <div className={cn('min-w-0 wrap-break-word sm:col-span-1', !beside && 'col-span-full')}>
        {/* Inline and positioned: the trigger sits at the end of the name's last line, never alone on one. */}
        <span className="relative">
          <label id={`${setting.id}-label`} htmlFor={setting.id} className="text-row font-medium">
            {setting.label}
            {/* Unbreakable room for the trigger, glued to the last word. */}
            {setting.help && <span aria-hidden="true">{HELP_ROOM}</span>}
          </label>

          {setting.help && (
            <span className="absolute -right-3.5 -bottom-3 inline-flex">
              <HelpTrigger question={`À quoi sert « ${setting.label} » ?`} help={setting.help} />
            </span>
          )}
        </span>
      </div>

      {/* Repere de la colonne de controle : son alignement est verifie d'un ecran a l'autre (ADR-15). */}
      <div
        data-setting-control
        className={cn(
          'flex min-w-0 items-center sm:justify-self-stretch',
          beside && 'justify-self-end',
        )}
      >
        <div className={cn('min-w-0', !beside && 'flex-1', beside && 'sm:flex-1')}>
          <SettingControl setting={setting} />
        </div>
      </div>

      {inherits && <InheritanceLock inherits={inherits} />}

      {setting.consequence && (
        <p className="col-span-full text-body text-muted-foreground">{setting.consequence}</p>
      )}
    </div>
  )
}

/** Closed while the value is inherited, a mark; open once it is set here, the way back. */
function InheritanceLock({ inherits }: { inherits: NonNullable<SettingDeclaration['inherits']> }) {
  const words = INHERITED_FROM[inherits.from]
  // Pulled into the grid gap, so the lock reads as the field's own.
  const intoTheGap = '-ml-2.5'

  if (inherits.inherited)
    return (
      <span
        role="img"
        aria-label={words.mark}
        title={words.mark}
        className={cn(
          'inline-flex size-11 items-center justify-center text-muted-foreground',
          intoTheGap,
        )}
      >
        <Lock className="size-4" aria-hidden="true" />
      </span>
    )

  const revert = `${words.revert} (${inherits.valueLabel})`
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('text-ink-muted hover:text-foreground', intoTheGap)}
      title={revert}
      aria-label={revert}
      onClick={inherits.onRevert}
    >
      <LockOpen className="size-4" aria-hidden="true" />
    </Button>
  )
}
