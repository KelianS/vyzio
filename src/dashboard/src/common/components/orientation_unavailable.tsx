import { Link } from 'react-router'

/** In place of a control the camera would refuse: the Connexion card says why and the way out (ADR-53). */
export function OrientationUnavailable({ cameraId }: { cameraId: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      L’orientation n’est pas disponible pour le moment : voir «{' '}
      <Link
        to={`/settings/cameras/${cameraId}/connexion`}
        className="underline underline-offset-2 hover:text-foreground"
      >
        Connexion
      </Link>
      {' '}».
    </p>
  )
}
