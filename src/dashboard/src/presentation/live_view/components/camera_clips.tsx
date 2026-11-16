import { History } from 'lucide-react'
import { ClipList } from '../../../common/detection/clip_list'
import { EmptyState } from '../../../common/components/empty_state'
import { ReadFailure } from '../../../common/components/error_message'
import { Loading } from '../../../common/components/loading'
import { SecondaryButton } from '../../../common/components/secondary_button'
import type { DetectionEvent } from '../../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../../domain/entities/detection_label.entity'
import type { AppError } from '../../../common/errors/app_error'

/** The Détections tab: this camera's clips, each played in place of the live picture (LIVE-20). */
export function CameraClips({
  clips,
  error,
  labels,
  apiBaseUrl,
  playingId,
  allTo,
  onPlay,
  onRetry,
}: {
  clips: DetectionEvent[] | null
  error: AppError | null
  labels: readonly DetectionLabel[]
  apiBaseUrl: string
  playingId: string | null
  /** The Détections page, filtered on this camera. */
  allTo: string
  onPlay: (event: DetectionEvent) => void
  onRetry: () => void
}) {
  if (error)
    return (
      <ReadFailure
        error={error}
        onRetry={onRetry}
        subject="Les détections de cette caméra n’ont pas pu être lues."
      />
    )
  if (clips === null) return <Loading />

  return (
    <div className="flex flex-col gap-4">
      {clips.length === 0 ? (
        <EmptyState>Aucune détection de cette caméra pour l’instant.</EmptyState>
      ) : (
        <ClipList
          events={clips}
          labels={labels}
          apiBaseUrl={apiBaseUrl}
          playingId={playingId}
          now={new Date()}
          onPlay={onPlay}
        />
      )}
      <SecondaryButton icon={History} to={allTo} className="self-start">
        Toutes ses détections
      </SecondaryButton>
    </div>
  )
}
