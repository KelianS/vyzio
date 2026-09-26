import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { AppHeader } from './common/components/app_header'
import { ToastProvider } from './common/components/toast'
import { useSystemStatsPolling } from './infrastructure/store/use_system_stats_polling'
import {
  AppContainerProvider,
  useAppContainer,
} from './infrastructure/providers/app_container.context'
import { OWN_HEADER, OWN_HEADER_ONLY } from './presentation/settings/settings.rubrics'
import { RestartSurveillanceTrigger } from './presentation/surveillance/restart_surveillance_trigger.component'
import { NavigationGuard } from './presentation/navigation/navigation_guard.component'
import { AccessGate } from './presentation/access/access_gate'
import { useCameraListFailureToast } from './presentation/cameras/camera_list_read'
import { reloadCameraList } from './presentation/cameras/camera_list_reload'

const HubView = lazy(() =>
  import('./presentation/hub/hub.component').then((m) => ({ default: m.HubView })),
)
const DetectionHistoryView = lazy(() =>
  import('./presentation/detection_history/detection_history.component').then((m) => ({
    default: m.DetectionHistoryView,
  })),
)
const SettingsView = lazy(() =>
  import('./presentation/settings/settings.component').then((m) => ({ default: m.SettingsView })),
)
const AddCameraView = lazy(() =>
  import('./presentation/cameras/add_camera.component').then((m) => ({ default: m.AddCameraView })),
)
const CamerasView = lazy(() =>
  import('./presentation/cameras/cameras.component').then((m) => ({ default: m.CamerasView })),
)
const CameraDetectionView = lazy(() =>
  import('./presentation/cameras/camera_detection.component').then((m) => ({
    default: m.CameraDetectionView,
  })),
)
const CameraConservationView = lazy(() =>
  import('./presentation/cameras/camera_conservation.component').then((m) => ({
    default: m.CameraConservationView,
  })),
)
const CameraPrivacyPage = lazy(() =>
  import('./presentation/cameras/camera_privacy_page').then((m) => ({
    default: m.CameraPrivacyPage,
  })),
)
const CameraImagePage = lazy(() =>
  import('./presentation/cameras/camera_image_page').then((m) => ({ default: m.CameraImagePage })),
)
const CameraConnectionPage = lazy(() =>
  import('./presentation/cameras/camera_connection_page').then((m) => ({
    default: m.CameraConnectionPage,
  })),
)
const PersonListPage = lazy(() =>
  import('./presentation/profiles/person_list_page').then((m) => ({ default: m.PersonListPage })),
)
const AddPersonPage = lazy(() =>
  import('./presentation/profiles/add_person_page').then((m) => ({ default: m.AddPersonPage })),
)
const PersonShell = lazy(() =>
  import('./presentation/profiles/person_shell').then((m) => ({ default: m.PersonShell })),
)
const PersonIdentityPage = lazy(() =>
  import('./presentation/profiles/person_identity_page').then((m) => ({
    default: m.PersonIdentityPage,
  })),
)
const PersonPhotosPage = lazy(() =>
  import('./presentation/profiles/person_photos_page').then((m) => ({
    default: m.PersonPhotosPage,
  })),
)
const PersonCamerasPage = lazy(() =>
  import('./presentation/profiles/person_cameras_page').then((m) => ({
    default: m.PersonCamerasPage,
  })),
)
const NotificationChannelListPage = lazy(() =>
  import('./presentation/notifications/notification_channel_list_page').then((m) => ({
    default: m.NotificationChannelListPage,
  })),
)
const AddNotificationChannelPage = lazy(() =>
  import('./presentation/notifications/add_notification_channel_page').then((m) => ({
    default: m.AddNotificationChannelPage,
  })),
)
const NotificationChannelPage = lazy(() =>
  import('./presentation/notifications/notification_channel_page').then((m) => ({
    default: m.NotificationChannelPage,
  })),
)
const ConservationPage = lazy(() =>
  import('./presentation/settings/conservation_page').then((m) => ({
    default: m.ConservationPage,
  })),
)
const AccessPage = lazy(() =>
  import('./presentation/settings/access_page').then((m) => ({ default: m.AccessPage })),
)
const SystemPage = lazy(() =>
  import('./presentation/settings/system_page').then((m) => ({ default: m.SystemPage })),
)
const ExpertView = lazy(() =>
  import('./presentation/expert/expert.component').then((m) => ({ default: m.ExpertView })),
)

function AppShell() {
  const { hub, cameras } = useAppContainer()
  useSystemStatsPolling(hub.getSystemStats)
  useCameraListFailureToast()

  // The camera catalogue is state shared between screens, so it loads here rather
  // than in whichever screen happened to need it first. Without that, opening the
  // camera list directly would show it empty.
  useEffect(() => {
    reloadCameraList(cameras)
  }, [cameras])

  return (
    <div className="grid min-w-0 max-w-full gap-6 pt-5 *:min-w-0">
      <AppHeader trailing={<RestartSurveillanceTrigger />} />
      {/* Unique garde de navigation : react-router n'en accepte qu'un. */}
      <NavigationGuard />
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </div>
  )
}

function Root() {
  return (
    <AppContainerProvider>
      <ToastProvider>
        {/* None of the application mounts before someone is in (ADR-54). */}
        <AccessGate>
          <AppShell />
        </AccessGate>
      </ToastProvider>
    </AppContainerProvider>
  )
}

// A data router (rather than `<BrowserRouter>`): it is what gives access to
// `useBlocker`, the only way to stop an edited page from being left silently (ADR-41).
const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      // Consultation
      { path: '/', element: <HubView /> },
      { path: '/history', element: <DetectionHistoryView /> },

      // Settings - a two-level tree (ADR-40). The route carries the selection: it,
      // and not a screen-held state, is what says where one is.
      {
        path: '/settings',
        element: <SettingsView />,
        children: [
          // Names the task, not the section.
          { path: 'cameras/ajout', element: <AddCameraView />, handle: OWN_HEADER },
          // One screen: the list, then the camera the route names, with its tabs.
          {
            path: 'cameras',
            element: <CamerasView />,
            children: [
              {
                path: ':cameraId',
                // Carries the name of the open camera, and its tabs.
                handle: OWN_HEADER,
                children: [
                  { index: true, element: <Navigate to="detection" replace /> },
                  { path: 'detection', element: <CameraDetectionView /> },
                  { path: 'conservation', element: <CameraConservationView /> },
                  { path: 'vie-privee', element: <CameraPrivacyPage /> },
                  { path: 'image', element: <CameraImagePage /> },
                  { path: 'connexion', element: <CameraConnectionPage /> },
                ],
              },
            ],
          },
          { path: 'detection', element: <Navigate to="/settings/detection/personnes" replace /> },
          // Screens not reworked yet: they already carry a title, never a back link.
          // The marker goes away with their rework, not before - without it the page
          // would announce itself twice.
          { path: 'detection/personnes', element: <PersonListPage /> },
          // Names the task, not the section.
          { path: 'detection/personnes/ajout', element: <AddPersonPage />, handle: OWN_HEADER },
          {
            path: 'detection/personnes/:profileId',
            element: <PersonShell />,
            // Carries the name of the open person, and their tabs.
            handle: OWN_HEADER,
            children: [
              { index: true, element: <Navigate to="identite" replace /> },
              { path: 'identite', element: <PersonIdentityPage /> },
              { path: 'photos', element: <PersonPhotosPage /> },
              { path: 'cameras', element: <PersonCamerasPage /> },
            ],
          },
          { path: 'conservation', element: <ConservationPage /> },
          { path: 'notifications', element: <NotificationChannelListPage /> },
          // Names the task, not the section.
          {
            path: 'notifications/ajout',
            element: <AddNotificationChannelPage />,
            handle: OWN_HEADER,
          },
          // Carries the name of the open channel.
          {
            path: 'notifications/:channel',
            element: <NotificationChannelPage />,
            handle: OWN_HEADER,
          },
          { path: 'acces', element: <AccessPage /> },
          { path: 'systeme', element: <SystemPage /> },
          { path: 'systeme/avance', element: <ExpertView />, handle: OWN_HEADER_ONLY },
        ],
      },

      // Former addresses: a kept link or a bookmark must not fall into the void
      // because the tree changed.
      { path: '/cameras', element: <Navigate to="/settings/cameras" replace /> },
      { path: '/profiles', element: <Navigate to="/settings/detection/personnes" replace /> },
      { path: '/notifications', element: <Navigate to="/settings/notifications" replace /> },
      { path: '/expert', element: <Navigate to="/settings/systeme/avance" replace /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
