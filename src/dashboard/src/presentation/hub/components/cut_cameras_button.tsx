import { Eye, EyeOff } from 'lucide-react'
import { SecondaryButton } from '../../../common/components/secondary_button'

/**
 * « Couper les caméras » opens the sheet; once every camera is cut, one tap resumes them all, the
 * label saying until when if they share an end. Neutral grey whatever the state: amber is Silence's (PRIV-22).
 */
export function CutCamerasButton({
  allCut,
  until,
  busy,
  onCut,
  onResume,
}: {
  allCut: boolean
  /** The end every camera shares, in the house's words; null when none. */
  until: string | null
  busy: boolean
  onCut: () => void
  onResume: () => void
}) {
  if (!allCut)
    return (
      <SecondaryButton icon={EyeOff} type="button" disabled={busy} onClick={onCut}>
        Couper les caméras
      </SecondaryButton>
    )
  if (until === null)
    return (
      <SecondaryButton icon={Eye} type="button" disabled={busy} onClick={onResume}>
        Réactiver les caméras
      </SecondaryButton>
    )
  return (
    <SecondaryButton icon={EyeOff} type="button" aria-pressed disabled={busy} onClick={onResume}>
      Caméras coupées jusqu’à {until}
    </SecondaryButton>
  )
}
