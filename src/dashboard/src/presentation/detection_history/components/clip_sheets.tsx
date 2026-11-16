import { Sheet, type SheetOption } from '../../../common/components/sheet'
import {
  carriesIdentity,
  formatClipDetail,
  formatEventTitle,
} from '../../../common/detection/detection_formatters'
import type { DetectionEvent } from '../../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../../domain/entities/detection_label.entity'
import type { Profile } from '../../../domain/entities/profile.entity'

/** The playing clip's « ⋯ » (HIST-18): correct who it shows, download it, delete it. */
export function ClipActionsSheet({
  event,
  labels,
  downloadable,
  onCorrect,
  onDownload,
  onDelete,
  onClose,
}: {
  event: DetectionEvent
  labels: readonly DetectionLabel[]
  /** Its video still exists: there is something to keep (HIST-19). */
  downloadable: boolean
  onCorrect: () => void
  onDownload: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const options: SheetOption[] = [
    ...(carriesIdentity(event)
      ? [{ key: 'identity', title: 'Corriger la reconnaissance', onPick: onCorrect }]
      : []),
    ...(downloadable
      ? [
          {
            key: 'download',
            title: 'Télécharger la vidéo',
            detail: 'Sur cet appareil, pour la garder ou la partager.',
            onPick: onDownload,
          },
        ]
      : []),
    { key: 'delete', title: 'Supprimer', destructive: true, onPick: onDelete },
  ]

  return (
    <Sheet
      title={formatEventTitle(event, labels)}
      effect={formatClipDetail(event, { camera: true })}
      options={options}
      onClose={onClose}
    />
  )
}

/** Who the clip really shows (UC-DET-02): one of the people, or nobody known. */
export function IdentitySheet({
  event,
  profiles,
  onPick,
  onClose,
}: {
  event: DetectionEvent
  profiles: readonly Profile[]
  onPick: (profile: Profile | null) => void
  onClose: () => void
}) {
  const options: SheetOption[] = [
    ...profiles.map((profile) => ({
      key: profile.id,
      title: profile.name,
      selected: event.profileId === profile.id,
      onPick: () => onPick(profile),
    })),
    {
      key: 'unknown',
      title: 'Inconnu',
      detail: 'Aucune des personnes que Vyzio connaît.',
      selected: event.profileId === null,
      onPick: () => onPick(null),
    },
  ]

  return (
    <Sheet
      title="Qui est-ce ?"
      effect="La détection prend le nom choisi."
      options={options}
      onClose={onClose}
    />
  )
}
