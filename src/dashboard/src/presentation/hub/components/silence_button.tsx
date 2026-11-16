import { BellOff } from 'lucide-react'
import { SecondaryButton } from '../../../common/components/secondary_button'
import { Button } from '../../../common/ui/button'

/** « Silence », amber while it holds and saying until when if it ends; a tap starts it or ends it (NOTIF-34). */
export function SilenceButton({
  active,
  until,
  busy,
  onStart,
  onStop,
}: {
  active: boolean
  /** The end, in the house's words; null when it holds until ended. */
  until: string | null
  busy: boolean
  onStart: () => void
  onStop: () => void
}) {
  if (!active)
    return (
      <SecondaryButton
        icon={BellOff}
        type="button"
        aria-pressed={false}
        disabled={busy}
        onClick={onStart}
      >
        Silence
      </SecondaryButton>
    )

  return (
    <Button
      type="button"
      aria-pressed
      disabled={busy}
      onClick={onStop}
      className="bg-silence font-bold text-silence-foreground hover:bg-silence/90"
    >
      <BellOff aria-hidden="true" />
      {until === null ? 'Silence activé' : `Silence jusqu’à ${until}`}
    </Button>
  )
}
