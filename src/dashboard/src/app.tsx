import { lazy } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { ToastProvider } from './common/components/toast'
import { AppContainerProvider } from './infrastructure/providers/app_container.context'
import { OWN_HEADER, OWN_HEADER_ONLY } from './presentation/settings/settings.rubrics'
import { AccessGate } from './presentation/access/access_gate.component'
import { AppShell } from './presentation/shell/app_shell.component'

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
const CameraPrivacyView = lazy(() =>
  import('./presentation/cameras/camera_privacy.component').then((m) => ({
    default: m.CameraPrivacyView,
  })),
)
const CameraImageView = lazy(() =>
  import('./presentation/cameras/camera_image.component').then((m) => ({
    default: m.CameraImageView,
  })),
)
const CameraConnectionView = lazy(() =>
  import('./presentation/cameras/camera_connection.component').then((m) => ({
    default: m.CameraConnectionView,
  })),
)
const PersonListView = lazy(() =>
  import('./presentation/profiles/person_list.component').then((m) => ({
    default: m.PersonListView,
  })),
)
const AddPersonView = lazy(() =>
  import('./presentation/profiles/add_person.component').then((m) => ({
    default: m.AddPersonView,
  })),
)
const PersonView = lazy(() =>
  import('./presentation/profiles/person.component').then((m) => ({ default: m.PersonView })),
)
const PersonIdentityView = lazy(() =>
  import('./presentation/profiles/person_identity.component').then((m) => ({
    default: m.PersonIdentityView,
  })),
)
const PersonPhotosView = lazy(() =>
  import('./presentation/profiles/person_photos.component').then((m) => ({
    default: m.PersonPhotosView,
  })),
)
const PersonCamerasView = lazy(() =>
  import('./presentation/profiles/person_cameras.component').then((m) => ({
    default: m.PersonCamerasView,
  })),
)
const NotificationChannelListView = lazy(() =>
  import('./presentation/notifications/notification_channel_list.component').then((m) => ({
    default: m.NotificationChannelListView,
  })),
)
const AddNotificationChannelView = lazy(() =>
  import('./presentation/notifications/add_notification_channel.component').then((m) => ({
    default: m.AddNotificationChannelView,
  })),
)
const NotificationChannelView = lazy(() =>
  import('./presentation/notifications/notification_channel.component').then((m) => ({
    default: m.NotificationChannelView,
  })),
)
const ConservationView = lazy(() =>
  import('./presentation/settings/conservation.component').then((m) => ({
    default: m.ConservationView,
  })),
)
const AccessView = lazy(() =>
  import('./presentation/settings/access.component').then((m) => ({ default: m.AccessView })),
)
const SystemView = lazy(() =>
  import('./presentation/settings/system.component').then((m) => ({ default: m.SystemView })),
)
const ExpertView = lazy(() =>
  import('./presentation/expert/expert.component').then((m) => ({ default: m.ExpertView })),
)

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
                  { path: 'vie-privee', element: <CameraPrivacyView /> },
                  { path: 'image', element: <CameraImageView /> },
                  { path: 'connexion', element: <CameraConnectionView /> },
                ],
              },
            ],
          },
          { path: 'detection', element: <Navigate to="/settings/detection/personnes" replace /> },
          // Screens not reworked yet: they already carry a title, never a back link.
          // The marker goes away with their rework, not before - without it the page
          // would announce itself twice.
          { path: 'detection/personnes', element: <PersonListView /> },
          // Names the task, not the section.
          { path: 'detection/personnes/ajout', element: <AddPersonView />, handle: OWN_HEADER },
          {
            path: 'detection/personnes/:profileId',
            element: <PersonView />,
            // Carries the name of the open person, and their tabs.
            handle: OWN_HEADER,
            children: [
              { index: true, element: <Navigate to="identite" replace /> },
              { path: 'identite', element: <PersonIdentityView /> },
              { path: 'photos', element: <PersonPhotosView /> },
              { path: 'cameras', element: <PersonCamerasView /> },
            ],
          },
          { path: 'conservation', element: <ConservationView /> },
          { path: 'notifications', element: <NotificationChannelListView /> },
          // Names the task, not the section.
          {
            path: 'notifications/ajout',
            element: <AddNotificationChannelView />,
            handle: OWN_HEADER,
          },
          // Carries the name of the open channel.
          {
            path: 'notifications/:channel',
            element: <NotificationChannelView />,
            handle: OWN_HEADER,
          },
          { path: 'acces', element: <AccessView /> },
          { path: 'systeme', element: <SystemView /> },
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
