import { Lock, LockOpen, Undo2 } from 'lucide-react'
import { Button } from '../ui/button'
import { HelpTrigger } from '../components/help_trigger'
import { cn } from '../ui/utils'
import { SettingControl } from './setting_control'
import type { SettingDeclaration, SettingNature } from './setting_declaration'

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

const INHERITED_MARK = 'Valeur de l’ensemble'

/** Pulled into the grid gap, so the lock or the arrow reads as the field's own. */
const INTO_THE_GAP = '-ml-2.5'

/** On a phone, the lock or the arrow takes a column of its own beside the control, whichever row that is. */
const PHONE_COLUMNS = {
  beside: {
    referenced: 'grid-cols-[minmax(0,1fr)_auto_auto]',
    plain: 'grid-cols-[minmax(0,1fr)_auto]',
  },
  under: { referenced: 'grid-cols-[minmax(0,1fr)_auto]', plain: 'grid-cols-1' },
} as const

/** Fixed row anatomy (ADR-15): label · help · control · lock or arrow, control column shared app-wide. */
export function SettingRow({ setting }: { setting: SettingDeclaration }) {
  const { inherits, recommended } = setting
  const beside = BESIDE_THE_NAME[setting.nature.kind]

  return (
    <div
      className={cn(
        'grid min-h-14 items-center gap-x-4 gap-y-2',
        PHONE_COLUMNS[beside ? 'beside' : 'under'][
          inherits || recommended ? 'referenced' : 'plain'
        ],
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
      {recommended && <RecommendationRevert recommended={recommended} />}

      {setting.consequence && (
        <p className="col-span-full text-body text-muted-foreground">{setting.consequence}</p>
      )}
    </div>
  )
}

/** Closed while the value is inherited, a mark; open once it is set here, the way back. */
function InheritanceLock({ inherits }: { inherits: NonNullable<SettingDeclaration['inherits']> }) {
  if (inherits.inherited)
    return (
      <span
        role="img"
        aria-label={INHERITED_MARK}
        title={INHERITED_MARK}
        className={cn(
          'inline-flex size-11 items-center justify-center text-muted-foreground',
          INTO_THE_GAP,
        )}
      >
        <Lock className="size-4" aria-hidden="true" />
      </span>
    )

  const revert = `Revenir à la valeur de l’ensemble (${inherits.valueLabel})`
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('text-ink-muted hover:text-foreground', INTO_THE_GAP)}
      title={revert}
      aria-label={revert}
      onClick={inherits.onRevert}
    >
      <LockOpen className="size-4" aria-hidden="true" />
    </Button>
  )
}

/** Nothing at the recommendation, its column kept so the field never moves; away from it, the way back. */
function RecommendationRevert({
  recommended,
}: {
  recommended: NonNullable<SettingDeclaration['recommended']>
}) {
  if (recommended.atRecommendation)
    return <span aria-hidden="true" className={cn('size-11', INTO_THE_GAP)} />

  const revert = `Revenir à la valeur recommandée (${recommended.valueLabel})`
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('text-muted-foreground hover:text-foreground', INTO_THE_GAP)}
      title={revert}
      aria-label={revert}
      onClick={recommended.onRevert}
    >
      <Undo2 className="size-4" aria-hidden="true" />
    </Button>
  )
}
