import { Link, NavLink, Outlet, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../../common/ui/utils'
import { useRootStore } from '../../infrastructure/store/rootStore'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { formatCameraAddress, formatCameraStatusLabel } from './cameras.formatters'

/**
 * The third level of the tree: the pages of **one** camera (ADR-40).
 *
 * Every page has a twin at installation level, or the other way round - setting a
 * camera means opening the same screen one notch lower. That is what makes the
 * override model of ADR-39 readable without explaining it.
 */
const CAMERA_PAGES = [
  { slug: 'detection', label: 'Détection' },
  { slug: 'conservation', label: 'Conservation' },
  { slug: 'vie-privee', label: 'Vie privée' },
  { slug: 'image', label: 'Image et pilotage' },
  { slug: 'connexion', label: 'Connexion' },
]

export function CameraShell() {
  const { cameraId } = useParams()
  const camera = useRootStore((state) => state.cameras.find((entry) => entry.id === cameraId))

  if (!camera) {
    return (
      // This route announces that it carries its own header: with no camera to name,
      // the failure has to do it, or the page would stay anonymous.
      <SettingsPage>
        <h1 className="font-serif text-3xl">Caméra introuvable</h1>
        <Link to="/settings/cameras" className="mt-3 inline-block underline underline-offset-2">
          Revenir à la liste des caméras
        </Link>
      </SettingsPage>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to="/settings/cameras"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Caméras
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-serif text-3xl">{camera.displayName}</h1>
          <span className="text-sm text-muted-foreground">
            {formatCameraAddress(camera)} · {formatCameraStatusLabel(camera.status)}
          </span>
        </div>
      </div>

      {/* Onglets plutot qu'une liste : a ce niveau les pages sont peu nombreuses
          et l'on passe de l'une a l'autre, au lieu d'entrer et de ressortir. */}
      <nav
        aria-label="Réglages de la caméra"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {CAMERA_PAGES.map((page) => (
          <NavLink
            key={page.slug}
            to={`/settings/cameras/${camera.id}/${page.slug}`}
            className={({ isActive }) =>
              cn(
                'shrink-0 rounded-lg px-3 py-2 text-sm transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isActive
                  ? 'bg-card font-medium shadow-xs'
                  : 'text-muted-foreground hover:bg-card/60',
              )
            }
          >
            {page.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={camera} />
    </div>
  )
}
