import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '../../../common/components/badge'
import { Button } from '../../../common/ui/button'
import { SettingsPage } from '../../../common/settings/settings_page'
import { ReadFailure } from '../../../common/components/error_message'
import type { AppError } from '../../../common/errors/app_error'
import type { Camera } from '../../../domain/entities/camera.entity'
import { formatCameraStatusLabel, formatStatusTone } from '../cameras.formatters'

/** The rubric with no camera chosen: the list. Adding a camera is its own task/page. */
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
  const unread = error !== null && cameras.length === 0

  return (
    <SettingsPage lede="Choisissez une caméra pour la régler.">
      {cameras.length > 0 ? (
        <ul className="divide-y divide-border">
          {cameras.map((camera) => (
            <li key={camera.id}>
              <Link
                to={`/settings/cameras/${camera.id}`}
                className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{camera.displayName}</span>
                  {/* Tells apart two cameras sharing a name, or the lenses of one device (SPECS 2.2). */}
                  <span className="block text-sm text-muted-foreground">{camera.host}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge tone={formatStatusTone(camera)}>
                    {formatCameraStatusLabel(camera.status)}
                  </Badge>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : unread ? (
        <ReadFailure
          error={error}
          onRetry={onRetry}
          subject="La liste de vos caméras n’a pas pu être lue."
          className="py-3"
        />
      ) : (
        <p className="py-3 text-muted-foreground">
          {loading ? 'Chargement…' : 'Aucune caméra pour l’instant.'}
        </p>
      )}

      {!unread && (
        <div className="mt-5">
          <Button asChild>
            <Link to="/settings/cameras/ajout">
              <Plus aria-hidden="true" />
              Ajouter une caméra
            </Link>
          </Button>
        </div>
      )}
    </SettingsPage>
  )
}
