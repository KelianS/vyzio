import { GroupedList, GroupedRow } from '../../../common/components/grouped_list'
import { ReadFailure } from '../../../common/components/error_message'
import { Loading } from '../../../common/components/loading'
import { markSubtitle } from '../../../common/components/status_mark_state'
import type { AppError } from '../../../common/errors/app_error'
import type { CameraProtocol } from '../../../domain/entities/camera_protocol.entity'
import { protocolMark } from '../capability_state'
import { PROTOCOL_LABELS } from '../protocol_labels'
import { protocolPath } from '../camera_paths'

/** The protocols the camera speaks, one row each with its mark, each opening its own page (CAM-17). */
export function ProtocolList({
  cameraId,
  protocols,
  loading,
  readError,
  onRetryRead,
}: {
  cameraId: string
  protocols: CameraProtocol[]
  loading: boolean
  readError: AppError | null
  onRetryRead: () => void
}) {
  if (loading) return <Loading />
  if (readError)
    return (
      <ReadFailure
        error={readError}
        onRetry={onRetryRead}
        subject="Les protocoles de cette caméra n’ont pas pu être lus."
      />
    )

  return (
    <GroupedList label="Protocoles">
      {protocols.map((entry) => {
        const mark = protocolMark(entry.status)
        return (
          <GroupedRow
            key={entry.protocol}
            to={protocolPath(cameraId, entry.protocol)}
            title={PROTOCOL_LABELS[entry.protocol]}
            mark={mark}
            subtitle={markSubtitle(mark) ?? undefined}
          />
        )
      })}
    </GroupedList>
  )
}
