import { Button } from '../ui/button'
import { ConfirmModal } from './confirm_modal'

interface DeleteActionProps {
  /** The button's words, naming what goes: `Supprimer cette caméra`. */
  label: string
  /** The confirmation's question and what the removal costs (UI-16). */
  question: string
  consequence: string
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
  confirming,
  deleting,
  onAsk,
  onConfirm,
  onCancel,
}: DeleteActionProps) {
  return (
    <div className="mt-8 border-t border-border pt-6">
      <Button type="button" variant="destructive-outline" onClick={onAsk}>
        {label}
      </Button>

      {confirming && (
        <ConfirmModal
          title={question}
          body={consequence}
          confirmLabel="Supprimer"
          tone="danger"
          loading={deleting}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
