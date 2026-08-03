import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '../../common/components/Badge'
import { Button } from '../../common/ui/button'
import { useRootStore } from '../../infrastructure/store/rootStore'
import { SettingsPage } from '../../common/settings/SettingsPage'
import {
  formatCameraAddress,
  formatCameraStatusLabel,
  formatStatusTone,
} from './cameras.formatters'

/** First level of the Cameras rubric: the list. Adding a camera is its own task/page. */
export function CameraListPage() {
  const cameras = useRootStore((state) => state.cameras)
  const loading = useRootStore((state) => state.camerasLoading)

  return (
    <SettingsPage lede="Choisissez une caméra pour la régler.">
      {cameras.length > 0 ? (
        <ul className="divide-y divide-border">
          {cameras.map((camera) => (
            <li key={camera.id}>
              <Link
                to={`/settings/cameras/${camera.id}/detection`}
                className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{camera.displayName}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatCameraAddress(camera)}
                  </span>
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
      ) : (
        <p className="py-3 text-muted-foreground">
          {loading ? 'Chargement…' : 'Aucune caméra pour l’instant.'}
        </p>
      )}

      <div className="mt-5">
        <Button asChild>
          <Link to="/settings/cameras/ajout">
            <Plus aria-hidden="true" />
            Ajouter une caméra
          </Link>
        </Button>
      </div>
    </SettingsPage>
  )
}
