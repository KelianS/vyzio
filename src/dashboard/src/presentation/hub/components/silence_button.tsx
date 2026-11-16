import { BellOff } from 'lucide-react'
import { SecondaryButton } from '../../../common/components/secondary_button'
import { Button } from '../../../common/ui/button'

/** « Silence », amber while it holds and saying until when; a tap starts it or ends it (NOTIF-34). */
export function SilenceButton({
  until,
  busy,
  onStart,
  onStop,
}: {
  /** The end, in the house's words; null while no Silence holds. */
  until: string | null
  busy: boolean
  onStart: () => void
  onStop: () => void
}) {
  if (until === null)
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
      Silence jusqu’à {until}
    </Button>
  )
}
