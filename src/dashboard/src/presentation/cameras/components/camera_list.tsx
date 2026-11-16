import { Plus, Video } from 'lucide-react'
import { markSubtitle } from '../../../common/components/status_mark_state'
import { GroupedList, GroupedRow } from '../../../common/components/grouped_list'
import { ReadFailure } from '../../../common/components/error_message'
import type { AppError } from '../../../common/errors/app_error'
import type { Camera } from '../../../domain/entities/camera.entity'
import { cameraMark } from '../../../common/camera/camera_status'
import { Loading } from '../../../common/components/loading'
import { Surface } from '../../../common/components/surface'

/** The rubric with no camera chosen: the list, each camera with its mark, adding one as its last row. */
export function CameraList({
  cameras,
  loading,
  error,
  onRetry,
}: {
  cameras: Camera[]
  loading: boolean
  error: AppError | null
  onRetry: () => void
}) {
  // An unread list is not an empty one: adding would invite duplicating cameras that exist.
  if (error !== null && cameras.length === 0)
    return (
      <Surface>
        <ReadFailure
          error={error}
          onRetry={onRetry}
          subject="La liste de vos caméras n’a pas pu être lue."
        />
      </Surface>
    )
  if (loading && cameras.length === 0)
    return (
      <Surface>
        <Loading />
      </Surface>
    )

  return (
    <GroupedList>
      {cameras.map((camera) => {
        const mark = cameraMark(camera)
        return (
          <GroupedRow
            key={camera.id}
            to={`/settings/cameras/${camera.id}`}
            icon={Video}
            title={camera.displayName}
            mark={mark}
            subtitle={markSubtitle(mark)}
          />
        )
      })}
      <GroupedRow
        to="/settings/cameras/add"
        icon={Plus}
        title="Ajouter une caméra"
        trailing="none"
      />
    </GroupedList>
  )
}
