import { Link } from 'react-router'
import { SurveillanceEntry } from '../../../common/camera/camera_status'

const LIVE_VIEW_WAITS =
  'La vue live, où se règlent ses positions, s’ouvre une fois la caméra en surveillance'

/** Where positions need the live view: says it waits for surveillance and leads to what is missing (SPECS 9.3). */
export function SurveillanceFirstNotice({
  cameraId,
  entry,
}: {
  cameraId: string
  entry: SurveillanceEntry
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
      // The restart trigger stays in the page header, never repeated in the tab.
      return (
        <p className="text-sm text-muted-foreground">
          {LIVE_VIEW_WAITS} : appliquez les changements, en haut de l’écran, pour qu’elle y entre.
        </p>
      )
    default: {
      const unknown: never = entry
      return unknown
    }
  }
}
