import { HelpCircle, Undo2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '../ui/utils'
import { SettingControl } from './SettingControl'
import type { SettingDeclaration } from './settingDeclaration'

/**
 * Anatomie **fixe** d'une ligne de reglage (ADR-43) :
 *
 *   nom · aide · controle · provenance · retour arriere
 *
 * Toujours les memes parties, dans le meme ordre, et le controle dans une
 * colonne de largeur commune a toute l'application — c'est ce qui aligne les
 * valeurs verticalement et permet de balayer une page au lieu de la lire.
 *
 * Sur petit ecran la ligne se plie en deux niveaux, nom au-dessus et controle
 * en dessous, mais la colonne reste commune.
 */
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

      <div className="flex min-w-0 sm:justify-self-stretch">
        <SettingControl setting={setting} />
      </div>

      {/* Le retour arriere n'existe que la ou il y a quelque chose a annuler.
          La colonne, elle, reste reservee, sinon les lignes se decaleraient
          selon qu'un reglage est surcharge ou non. */}
      <div className="hidden sm:flex sm:justify-center">
        {provenance && !provenance.following && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-accent-foreground/70 hover:text-foreground"
            title={revertLabel}
            aria-label={revertLabel}
            onClick={provenance.onRevert}
          >
            <Undo2 aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Sur mobile le retour arriere passe sous le controle : une colonne de
          plus y serait illisible. */}
      {provenance && !provenance.following && (
        <button
          type="button"
          className="justify-self-start text-sm text-muted-foreground underline underline-offset-2 sm:hidden"
          onClick={provenance.onRevert}
        >
          {revertLabel}
        </button>
      )}

      {setting.consequence && (
        <p className="text-sm text-muted-foreground sm:col-span-3">{setting.consequence}</p>
      )}
    </div>
  )
}

/**
 * L'aide, derriere un declencheur **explicite**. Jamais au survol seul : sur la
 * cible mobile, une info-bulle au survol est inatteignable au doigt, donc
 * inexistante.
 */
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
