import { Button } from '../ui/button'
import { cn } from '../ui/utils'
import type { DraftChange } from './useSettingsDraft'

/**
 * The draft action bar (ADR-41).
 *
 * It sits in a **fixed position, identical everywhere**, at the bottom of the
 * visible area rather than at a varying place in the content flow: that is what
 * makes it findable, notably on mobile where a button at the end of the page is
 * off screen.
 *
 * It says **what changed**, and nothing more: saving does not interrupt
 * surveillance, the interruption belongs to the restart (ADR-44).
 */
export function SettingsDraftBar({
  changes,
  saving,
  onSave,
  onDiscard,
}: {
  changes: readonly DraftChange[]
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}) {
  if (changes.length === 0) return null

  const count = changes.length
  const summary = changes.map((change) => change.label).join(', ')

  return (
    <div
      role="region"
      aria-label="Modifications en attente"
      className={cn(
        'sticky bottom-4 z-50 mt-4 flex flex-wrap items-center gap-x-4 gap-y-3',
        'rounded-card border border-border bg-card p-3 shadow-[var(--shadow-soft)] sm:px-4',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{count === 1 ? '1 modification' : `${count} modifications`}</p>
        {/* Nommer les reglages touches, pas seulement les compter : « ce qui a
            ete modifie » est precisement ce que l'utilisateur ne voyait pas. */}
        <p className="truncate text-sm text-muted-foreground" title={summary}>
          {summary}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onDiscard}>
          Annuler
        </Button>
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}
