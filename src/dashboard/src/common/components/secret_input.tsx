import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../ui/utils'

/** A password or secret field whose eye, inside it, shows what was typed then masks it again (UI-38). */
export function SecretInput({
  label,
  validating = false,
  className,
  ...input
}: Omit<ComponentProps<'input'>, 'type'> & {
  /** The field's name, which the eye names too, so two eyes on a page never read alike. */
  label: string
  /** True while what was typed is being validated: the field masks again as it starts. */
  validating?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const [wasValidating, setWasValidating] = useState(validating)

  if (validating !== wasValidating) {
    setWasValidating(validating)
    if (validating) setRevealed(false)
  }

  return (
    // Stacked in one grid cell, not positioned, so it never paints over a neighbour's tap area.
    <div className="grid w-full items-center">
      <Input
        {...input}
        type={revealed ? 'text' : 'password'}
        className={cn('col-start-1 row-start-1 pr-13', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="col-start-1 row-start-1 mr-1 justify-self-end text-muted-foreground hover:bg-transparent hover:text-foreground"
        aria-label={`${revealed ? 'Masquer' : 'Afficher'} « ${label} »`}
        disabled={input.disabled}
        // The keyboard stays open on a phone and the caret where it was.
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => setRevealed((previous) => !previous)}
      >
        {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  )
}
