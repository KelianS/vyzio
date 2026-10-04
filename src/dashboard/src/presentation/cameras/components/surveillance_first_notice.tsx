import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { SurveillanceEntry } from '../../../common/camera/camera_status'

const LIVE_VIEW_WAITS =
  'La vue live, où se règlent ses positions, s’ouvre une fois la caméra en surveillance'

/** Where a setting needs the live view: says it waits for surveillance and leads to what is missing (SPECS 9.3). */
export function SurveillanceFirstNotice({
  cameraId,
  entry,
  restartTrigger,
}: {
  cameraId: string
  entry: SurveillanceEntry
  restartTrigger: ReactNode
}) {
  switch (entry) {
    case SurveillanceEntry.Watched:
      return null
    case SurveillanceEntry.AwaitsStream:
      return (
        <p className="text-sm text-muted-foreground">
          {LIVE_VIEW_WAITS}, et son flux vidéo n’a pas encore fonctionné : voir «{' '}
          <Link
            to={`/settings/cameras/${cameraId}/connexion`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Connexion
          </Link>{' '}
          ».
        </p>
      )
    case SurveillanceEntry.AwaitsRestart:
      return (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            {LIVE_VIEW_WAITS} : appliquez les changements pour qu’elle y entre.
          </p>
          {restartTrigger}
        </div>
      )
    default: {
      const unknown: never = entry
      return unknown
    }
  }
}
