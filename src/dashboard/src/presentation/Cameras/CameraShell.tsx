import { Link, Outlet, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { TabBar } from '../../common/components/TabBar'
import { useRootStore } from '../../infrastructure/store/rootStore'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { ReadFailure } from '../../common/components/ErrorMessage'
import { useReloadCameraList } from './cameraListRead'
import { formatCameraStatusLabel } from './cameras.formatters'

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
  const loading = useRootStore((state) => state.camerasLoading)
  const error = useRootStore((state) => state.camerasError)
  const reload = useReloadCameraList()

  if (!camera && loading) return <SettingsPage>Chargement…</SettingsPage>

  // An unread list says nothing about this camera: "not found" would be a false answer.
  if (!camera && error) {
    return (
      <SettingsPage>
        <h1 className="font-serif text-3xl">Cette caméra ne s’affiche pas</h1>
        <ReadFailure error={error} onRetry={reload} className="mt-3" />
        <Link to="/settings/cameras" className="mt-3 inline-block underline underline-offset-2">
          Revenir à la liste des caméras
        </Link>
      </SettingsPage>
    )
  }

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
