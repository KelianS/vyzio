import { Sheet } from '../../../common/components/sheet'
import type { CamerasCut } from '../../../domain/entities/cameras_cut.entity'
import type { ChosenEnd } from '../../../domain/entities/chosen_end.entity'
import { endOptions } from './end_options'

/** How long every camera stays cut; picking an option is the confirmation (PRIV-22). */
export function CutSheet({
  scheduleNextChange,
  now,
  onCut,
  onClose,
}: {
  scheduleNextChange: CamerasCut['scheduleNextChange']
  now: Date
  onCut: (end: ChosenEnd) => void
  onClose: () => void
}) {
  return (
    <Sheet
      title="Couper les caméras"
      effect="Toutes les caméras sont coupées : Vyzio n’enregistre plus rien."
      options={endOptions(scheduleNextChange, now, onCut)}
      onClose={onClose}
    />
  )
}
