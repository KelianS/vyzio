import { Button } from '../ui/button'
import { ConfirmModal } from './confirm_modal'

interface DeleteActionProps {
  /** The button's words, naming what goes: `Supprimer cette caméra`. */
  label: string
  /** The confirmation's question and what the removal costs (UI-19). */
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
    <div className="flex flex-col">
      <Button type="button" variant="destructive-outline" className="w-full" onClick={onAsk}>
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
