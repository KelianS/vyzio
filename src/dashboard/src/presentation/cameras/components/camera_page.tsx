import { Link, Outlet } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { TabBar } from '../../../common/components/tab_bar'
import { SettingsPage } from '../../../common/settings/settings_page'
import { ReadFailure } from '../../../common/components/error_message'
import type { AppError } from '../../../common/errors/app_error'
import type { Camera } from '../../../domain/entities/camera.entity'
import { formatCameraStatusLabel } from '../../../common/camera/camera_status'
import { CameraNotFound } from './camera_not_found'

// The pages of one camera, each the twin of an installation page one notch lower (ADR-39, ADR-40).
const CAMERA_PAGES = [
  { slug: 'connexion', label: 'Connexion' },
  { slug: 'vie-privee', label: 'Vie privée' },
  { slug: 'detection', label: 'Détection' },
  { slug: 'image', label: 'Image et pilotage' },
  { slug: 'conservation', label: 'Conservation' },
]

export function CameraPage({
  camera,
  loading,
  error,
  onRetry,
}: {
  camera: Camera | undefined
  loading: boolean
  error: AppError | null
  onRetry: () => void
}) {
  if (!camera && loading) return <SettingsPage>Chargement…</SettingsPage>

  // An unread list says nothing about this camera: "not found" would be a false answer.
  if (!camera && error) {
    return (
      <SettingsPage>
        <h1 className="font-serif text-3xl">Cette caméra ne s’affiche pas</h1>
        <ReadFailure error={error} onRetry={onRetry} className="mt-3" />
        <Link to="/settings/cameras" className="mt-3 inline-block underline underline-offset-2">
          Revenir à la liste des caméras
        </Link>
      </SettingsPage>
    )
  }

  if (!camera) {
    return (
      // The route carries its own header: with no camera to name, the failure names the page.
      <SettingsPage>
        <CameraNotFound within="page" />
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
            {formatCameraStatusLabel(camera.status)}
          </span>
        </div>
      </div>

      {/* Tabs rather than a list: few pages at this level, and one moves between them. */}
      <TabBar
        label="Réglages de la caméra"
        tabs={CAMERA_PAGES.map((page) => ({
          to: `/settings/cameras/${camera.id}/${page.slug}`,
          label: page.label,
        }))}
      />

      <Outlet context={camera} />
    </div>
  )
}
