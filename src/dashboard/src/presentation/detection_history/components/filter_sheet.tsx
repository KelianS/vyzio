import { Sheet, type SheetOption } from '../../../common/components/sheet'
import type { Camera } from '../../../domain/entities/camera.entity'
import type { DetectionLabel } from '../../../domain/entities/detection_label.entity'
import type { Profile } from '../../../domain/entities/profile.entity'

/** The filter of the bar (HIST-03): one group per axis, a tap narrows the list and closes the sheet. */
export function FilterSheet({
  cameras,
  profiles,
  labels,
  cameraId,
  profileId,
  label,
  onCamera,
  onProfile,
  onLabel,
  onClose,
}: {
  cameras: readonly Camera[]
  profiles: readonly Profile[]
  labels: readonly DetectionLabel[]
  cameraId: string
  profileId: string
  label: string
  onCamera: (cameraId: string) => void
  onProfile: (profileId: string) => void
  onLabel: (label: string) => void
  onClose: () => void
}) {
  const options: SheetOption[] = [
    ...axis(
      'Caméra',
      'Toutes les caméras',
      cameras.map((camera) => ({ value: camera.id, title: camera.displayName })),
      cameraId,
      onCamera,
    ),
    ...axis(
      'Personne',
      'Toutes les personnes',
      profiles.map((profile) => ({ value: profile.id, title: profile.name })),
      profileId,
      onProfile,
    ),
    ...axis(
      'Type',
      'Tous les types',
      labels.map((known) => ({ value: known.value, title: known.displayName })),
      label,
      onLabel,
    ),
  ]

  return (
    <Sheet
      title="Filtrer"
      effect="Ne montrer que les détections d’une caméra, d’une personne ou d’un type."
      options={options}
      onClose={onClose}
    />
  )
}

/** One axis: « all » first, then its values, the current one checked; nothing when it has no value. */
function axis(
  group: string,
  all: string,
  values: { value: string; title: string }[],
  current: string,
  onPick: (value: string) => void,
): SheetOption[] {
  if (values.length === 0) return []
  return [{ value: '', title: all }, ...values].map((option) => ({
    key: `${group}-${option.value}`,
    group,
    title: option.title,
    selected: option.value === current,
    onPick: () => onPick(option.value),
  }))
}
