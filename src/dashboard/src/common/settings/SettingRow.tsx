import { HelpCircle, Undo2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '../ui/utils'
import { SettingControl } from './SettingControl'
import type { SettingDeclaration } from './settingDeclaration'

/** Fixed row anatomy (ADR-43): label · help · control · provenance · revert, control column shared app-wide. */
export function SettingRow({ setting }: { setting: SettingDeclaration }) {
  const { provenance } = setting
  const revertLabel = provenance && `${provenance.revertLabel} : ${provenance.fallbackLabel}`

  return (
    <div
      className={cn(
        'grid grid-cols-1 items-center gap-x-4 gap-y-2 py-3.5',
        'sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_2rem]',
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <label
          id={`${setting.id}-label`}
          htmlFor={setting.id}
          className="font-medium wrap-break-word"
        >
          {setting.label}
        </label>

        {setting.help && <HelpTrigger label={setting.label} help={setting.help} />}
      </div>

      {/* Repere de la colonne de controle : son alignement est verifie d'un ecran a l'autre (ADR-43). */}
      <div
        data-setting-control
        className="flex min-w-0 items-center gap-1.5 sm:justify-self-stretch"
      >
        <div className="min-w-0 flex-1">
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
        <p className="text-sm text-muted-foreground sm:col-span-3">{setting.consequence}</p>
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
      size="icon"
      className={cn('size-8 shrink-0 text-accent-foreground/70 hover:text-foreground', className)}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Undo2 aria-hidden="true" />
    </Button>
  )
}

/** Help behind an explicit trigger, never hover-only — unreachable by touch. */
function HelpTrigger({ label, help }: { label: string; help: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`À quoi sert « ${label} » ?`}
        >
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-80 text-sm">
        {help}
      </PopoverContent>
    </Popover>
  )
}
