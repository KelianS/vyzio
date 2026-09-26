import { useEffect, useState } from 'react'
import { cn } from '../../../common/ui/utils'
import { liveFrameUrl, liveWaitMessage } from '../../../common/components/live_frame'
import { LiveWaitVeil } from '../../../common/components/live_wait_veil'
import type { FrigateStatus } from '../../../domain/entities/system_stats.entity'

const REFRESH_MS = 1000

/** The live picture, refreshed every second, veiled while surveillance restarts or reconnects. */
export function LiveImage({
  cameraId,
  apiBaseUrl,
  label,
  frigateStatus,
}: {
  cameraId: string
  apiBaseUrl: string
  label: string
  frigateStatus: FrigateStatus
}) {
  const [src, setSrc] = useState(() => liveFrameUrl(apiBaseUrl, cameraId))
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setSrc(liveFrameUrl(apiBaseUrl, cameraId)), REFRESH_MS)
    return () => clearInterval(interval)
  }, [cameraId, apiBaseUrl])

  const waitMessage = liveWaitMessage(frigateStatus, imageError)

  return (
    // An image without data loses its size: the floor keeps the waiting veil full size.
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-lg',
        waitMessage && 'aspect-video w-[min(90vw,48rem)] bg-surface-inverse',
      )}
    >
      <img
        src={src}
        alt={label}
        className={cn('block max-h-[75vh] max-w-[90vw] rounded-lg', waitMessage && 'invisible')}
        onError={() => setImageError(true)}
        onLoad={() => setImageError(false)}
      />
      {waitMessage && <LiveWaitVeil message={waitMessage} />}
    </div>
  )
}
