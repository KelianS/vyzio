import { Undo2 } from 'lucide-react'
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

/** Fixed row anatomy (ADR-15): label · help · control · provenance · revert, control column shared app-wide. */
export function SettingRow({ setting }: { setting: SettingDeclaration }) {
  const { provenance } = setting
  const revertLabel = provenance && `${provenance.revertLabel} : ${provenance.fallbackLabel}`
  const subtitle =
    provenance?.subtitles &&
    (provenance.following ? provenance.subtitles.following : provenance.subtitles.own)
  const beside = BESIDE_THE_NAME[setting.nature.kind]

  return (
    <div
      className={cn(
        'grid min-h-14 items-center gap-x-4 gap-y-2',
        beside ? 'grid-cols-[minmax(0,1fr)_auto] py-2.5' : 'grid-cols-1 py-3.5',
        'sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_2rem]',
      )}
    >
      <div className="flex min-w-0 flex-col">
        <div className="min-w-0 wrap-break-word">
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

        {subtitle && <p className="text-body text-muted-foreground">{subtitle}</p>}
      </div>

      {/* Repere de la colonne de controle : son alignement est verifie d'un ecran a l'autre (ADR-15). */}
      <div
        data-setting-control
        className={cn(
          'flex min-w-0 items-center gap-1.5 sm:justify-self-stretch',
          beside && 'justify-self-end',
        )}
      >
        <div className={cn('min-w-0', !beside && 'flex-1', beside && 'sm:flex-1')}>
          <SettingControl setting={setting} />
        </div>

        {/* Meme geste sur mobile qu'en colonne desktop : une icone-fleche, pas
            un lien texte — le retour arriere est une action, pas une phrase. */}
        {provenance && !provenance.following && (
          <RevertButton label={revertLabel!} onClick={provenance.onRevert} className="sm:hidden" />
        )}
      </div>

      {/* Le retour arriere n'existe que la ou il y a quelque chose a annuler.
          La colonne, elle, reste reservee, sinon les lignes se decaleraient
          selon qu'un reglage est surcharge ou non. */}
      <div className="hidden sm:flex sm:justify-center">
        {provenance && !provenance.following && (
          <RevertButton label={revertLabel!} onClick={provenance.onRevert} />
        )}
      </div>

      {setting.consequence && (
        <p className="col-span-full text-body text-muted-foreground">{setting.consequence}</p>
      )}
    </div>
  )
}

/** Arrow icon everywhere — revert names what it restores via title/aria-label, never a visible label. */
function RevertButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('text-accent-foreground/70 hover:text-foreground', className)}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Undo2 aria-hidden="true" />
    </Button>
  )
}
