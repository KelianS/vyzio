import { lazy } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { ToastProvider } from './common/components/toast'
import { AppContainerProvider } from './infrastructure/providers/app_container.context'
import { OWN_HEADER } from './presentation/settings/settings.rubrics'
import { AccessGate } from './presentation/access/access_gate.component'
import { AppShell } from './presentation/shell/app_shell.component'
import { LIVE_VIEW_ROUTE } from './presentation/live_view/live_view.route'
import { CAMERA_WALL_ROUTE } from './presentation/camera_wall/camera_wall.route'

const HubView = lazy(() =>
  import('./presentation/hub/hub.component').then((m) => ({ default: m.HubView })),
)
const CameraWallView = lazy(() =>
  import('./presentation/camera_wall/camera_wall.component').then((m) => ({
    default: m.CameraWallView,
  })),
)
const LiveViewScreen = lazy(() =>
  import('./presentation/live_view/live_view.component').then((m) => ({
    default: m.LiveViewScreen,
  })),
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
const ScheduleWeekView = lazy(() =>
  import('./presentation/schedules/schedule_week.component').then((m) => ({
    default: m.ScheduleWeekView,
  })),
)
const ScheduleRuleView = lazy(() =>
  import('./presentation/schedules/schedule_rule.component').then((m) => ({
    default: m.ScheduleRuleView,
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
        {/* None of the application mounts before someone is in (ADR-16). */}
        <AccessGate>
          <AppShell />
        </AccessGate>
      </ToastProvider>
    </AppContainerProvider>
  )
}

// A data router (rather than `<BrowserRouter>`): it is what gives access to
// `useBlocker`, the only way to stop an edited page from being left silently (ADR-15).
const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      // Consultation
      { path: '/', element: <HubView /> },
      { path: CAMERA_WALL_ROUTE, element: <CameraWallView /> },
      { path: '/detections', element: <DetectionHistoryView /> },
      // A screen of its own, never a layer over a page (LIVE-19).
      { path: LIVE_VIEW_ROUTE, element: <LiveViewScreen /> },

      // Settings - a two-level tree (UI-25). The route carries the selection: it,
      // and not a screen-held state, is what says where one is.
      {
        path: '/settings',
        element: <SettingsView />,
        children: [
          // Names the task, not the section.
          { path: 'cameras/add', element: <AddCameraView />, handle: OWN_HEADER },
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
                  // A camera always opens on Connexion (CAM-61).
                  { index: true, element: <Navigate to="connection" replace /> },
                  { path: 'connection', element: <CameraConnectionView /> },
                  { path: 'privacy', element: <CameraPrivacyView /> },
                  { path: 'detection', element: <CameraDetectionView /> },
                  { path: 'image', element: <CameraImageView /> },
                  { path: 'retention', element: <CameraConservationView /> },
                ],
              },
            ],
          },
          { path: 'detection', element: <Navigate to="/settings/detection/people" replace /> },
          { path: 'detection/people', element: <PersonListView /> },
          // Names the task, not the section.
          { path: 'detection/people/add', element: <AddPersonView />, handle: OWN_HEADER },
          {
            path: 'detection/people/:profileId',
            element: <PersonView />,
            // Carries the name of the open person, and their tabs.
            handle: OWN_HEADER,
            children: [
              { index: true, element: <Navigate to="identity" replace /> },
              { path: 'identity', element: <PersonIdentityView /> },
              { path: 'photos', element: <PersonPhotosView /> },
              { path: 'cameras', element: <PersonCamerasView /> },
            ],
          },
          { path: 'retention', element: <ConservationView /> },
          { path: 'notifications', element: <NotificationChannelListView /> },
          // Names the task, not the section.
          {
            path: 'notifications/add',
            element: <AddNotificationChannelView />,
            handle: OWN_HEADER,
          },
          // Carries the name of the open channel.
          {
            path: 'notifications/:channel',
            element: <NotificationChannelView />,
            handle: OWN_HEADER,
          },
          { path: 'schedule', element: <ScheduleWeekView /> },
          { path: 'schedule/add', element: <ScheduleRuleView />, handle: OWN_HEADER },
          { path: 'schedule/:ruleId', element: <ScheduleRuleView />, handle: OWN_HEADER },
          { path: 'access', element: <AccessView /> },
          { path: 'hardware', element: <SystemView /> },
          { path: 'hardware/advanced', element: <ExpertView />, handle: OWN_HEADER },
        ],
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
