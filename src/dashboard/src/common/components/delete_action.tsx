import { Button } from '../ui/button'
import { ConfirmModal } from './confirm_modal'

interface DeleteActionProps {
  /** The button's words, naming what goes: `Supprimer cette caméra`. */
  label: string
  /** The confirmation's question and what the removal costs (UI-19). */
  question: string
  consequence: string
  /** The confirmation's button, `Supprimer` unless the thing is taken off rather than deleted. */
  confirmLabel?: string
  /** Why it cannot go now, in one line beside the disabled button; null when it can. */
  blocker?: string | null
  confirming: boolean
  deleting: boolean
  onAsk: () => void
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

/** Removing what the page names: quiet and last on the page, solid red only in its confirmation. */
export function DeleteAction({
  label,
  question,
  consequence,
  confirmLabel = 'Supprimer',
  blocker = null,
  confirming,
  deleting,
  onAsk,
  onConfirm,
  onCancel,
}: DeleteActionProps) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="destructive-outline"
        className="w-full"
        disabled={blocker !== null}
        onClick={onAsk}
      >
        {label}
      </Button>
      {blocker && <p className="mx-1 text-body text-muted-foreground">{blocker}</p>}

      {confirming && (
        <ConfirmModal
          title={question}
          body={consequence}
          confirmLabel={confirmLabel}
          tone="danger"
          loading={deleting}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
