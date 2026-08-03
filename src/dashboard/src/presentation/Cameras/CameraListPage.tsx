import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { useRootStore } from '../../infrastructure/store/rootStore'
import { SettingsPage } from '../../common/settings/SettingsPage'
import {
  formatCameraAddress,
  formatCameraStatusLabel,
  formatStatusTone,
} from './cameras.formatters'

/**
 * Premier niveau de la rubrique Cameras : **la liste**.
 *
 * Ajouter une camera est une tache distincte, avec sa propre page — la
 * decouverte reseau occupait jusqu'ici tout l'ecran alors qu'elle ne sert qu'une
 * fois par camera, en reléguant la liste au second plan.
 */
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
                  <span className={cn('status-pill', formatStatusTone(camera))}>
                    {formatCameraStatusLabel(camera.status)}
                  </span>
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
