import { Link, Outlet, useMatches } from 'react-router'
import { TabBar } from '../../../common/components/tab_bar'
import { SettingsPage } from '../../../common/settings/settings_page'
import { ReadFailure } from '../../../common/components/error_message'
import type { AppError } from '../../../common/errors/app_error'
import type { Camera } from '../../../domain/entities/camera.entity'
import { cameraMark } from '../../../common/camera/camera_status'
import { PageHeader } from '../../../common/components/page_header'
import { CameraNotFound } from './camera_not_found'
import { Loading } from '../../../common/components/loading'
import { isSubPage } from '../../settings/settings.rubrics'

// The pages of one camera, each the twin of an installation page one notch lower (UI-08).
const CAMERA_PAGES = [
  { slug: 'connection', label: 'Connexion' },
  { slug: 'privacy', label: 'Vie privée' },
  { slug: 'detection', label: 'Détection' },
  { slug: 'image', label: 'Image et pilotage' },
  { slug: 'retention', label: 'Conservation' },
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
  const subPage = isSubPage(useMatches())

  if (!camera && loading)
    return (
      <SettingsPage>
        <Loading />
      </SettingsPage>
    )

  // An unread list says nothing about this camera: "not found" would be a false answer.
  if (!camera && error) {
    return (
      <SettingsPage>
        <h1 className="text-title">Cette caméra ne s’affiche pas</h1>
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

  // A sub-page names itself and leads back to its tab: neither the camera's name nor its tabs.
  if (subPage) return <Outlet context={camera} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={camera.displayName} mark={cameraMark(camera)} />

      {/* Tabs rather than a list: few pages at this level, and one moves between them. */}
      <TabBar
        label="Réglages de la caméra"
        tabs={CAMERA_PAGES.map((page) => ({
          to: `/settings/cameras/${camera.id}/${page.slug}`,
          label: page.label,
        }))}
      >
        <Outlet context={camera} />
      </TabBar>
    </div>
  )
}
