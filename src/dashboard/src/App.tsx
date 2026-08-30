import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { AppHeader } from './common/components/AppHeader'
import { ToastProvider } from './common/components/Toast'
import { useSystemStatsPolling } from './infrastructure/store/useSystemStatsPolling'
import { useRootStore } from './infrastructure/store/rootStore'
import {
  AppContainerProvider,
  useAppContainer,
} from './infrastructure/providers/AppContainerContext'
import { OWN_HEADER, OWN_HEADER_ONLY } from './presentation/Settings/settings.rubrics'
import { RestartSurveillanceTrigger } from './presentation/Surveillance/RestartSurveillanceTrigger'
import { NavigationGuard } from './presentation/Navigation/NavigationGuard'
import { AccessGate } from './presentation/Access/AccessGate'

const HubView = lazy(() =>
  import('./presentation/Hub/Hub.Component').then((m) => ({ default: m.HubView })),
)
const DetectionHistoryView = lazy(() =>
  import('./presentation/DetectionHistory/DetectionHistory.Component').then((m) => ({
    default: m.DetectionHistoryView,
  })),
)
const SettingsView = lazy(() =>
  import('./presentation/Settings/Settings.Component').then((m) => ({ default: m.SettingsView })),
)
const AddCameraView = lazy(() =>
  import('./presentation/Cameras/AddCamera.Component').then((m) => ({ default: m.AddCameraView })),
)
const CameraListPage = lazy(() =>
  import('./presentation/Cameras/CameraListPage').then((m) => ({ default: m.CameraListPage })),
)
const CameraShell = lazy(() =>
  import('./presentation/Cameras/CameraShell').then((m) => ({ default: m.CameraShell })),
)
const CameraDetectionPage = lazy(() =>
  import('./presentation/Cameras/CameraDetectionPage').then((m) => ({
    default: m.CameraDetectionPage,
  })),
)
const CameraConservationPage = lazy(() =>
  import('./presentation/Cameras/CameraConservationPage').then((m) => ({
    default: m.CameraConservationPage,
  })),
)
const CameraPrivacyPage = lazy(() =>
  import('./presentation/Cameras/CameraPrivacyPage').then((m) => ({
    default: m.CameraPrivacyPage,
  })),
)
const CameraImagePage = lazy(() =>
  import('./presentation/Cameras/CameraImagePage').then((m) => ({ default: m.CameraImagePage })),
)
const CameraConnectionPage = lazy(() =>
  import('./presentation/Cameras/CameraConnectionPage').then((m) => ({
    default: m.CameraConnectionPage,
  })),
)
const PersonListPage = lazy(() =>
  import('./presentation/Profiles/PersonListPage').then((m) => ({ default: m.PersonListPage })),
)
const AddPersonPage = lazy(() =>
  import('./presentation/Profiles/AddPersonPage').then((m) => ({ default: m.AddPersonPage })),
)
const PersonShell = lazy(() =>
  import('./presentation/Profiles/PersonShell').then((m) => ({ default: m.PersonShell })),
)
const PersonIdentityPage = lazy(() =>
  import('./presentation/Profiles/PersonIdentityPage').then((m) => ({
    default: m.PersonIdentityPage,
  })),
)
const PersonPhotosPage = lazy(() =>
  import('./presentation/Profiles/PersonPhotosPage').then((m) => ({ default: m.PersonPhotosPage })),
)
const PersonCamerasPage = lazy(() =>
  import('./presentation/Profiles/PersonCamerasPage').then((m) => ({
    default: m.PersonCamerasPage,
  })),
)
const NotificationChannelListPage = lazy(() =>
  import('./presentation/Notifications/NotificationChannelListPage').then((m) => ({
    default: m.NotificationChannelListPage,
  })),
)
const AddNotificationChannelPage = lazy(() =>
  import('./presentation/Notifications/AddNotificationChannelPage').then((m) => ({
    default: m.AddNotificationChannelPage,
  })),
)
const NotificationChannelPage = lazy(() =>
  import('./presentation/Notifications/NotificationChannelPage').then((m) => ({
    default: m.NotificationChannelPage,
  })),
)
const ConservationPage = lazy(() =>
  import('./presentation/Settings/ConservationPage').then((m) => ({ default: m.ConservationPage })),
)
const AccessPage = lazy(() =>
  import('./presentation/Settings/AccessPage').then((m) => ({ default: m.AccessPage })),
)
const SystemPage = lazy(() =>
  import('./presentation/Settings/SystemPage').then((m) => ({ default: m.SystemPage })),
)
const ExpertView = lazy(() =>
  import('./presentation/Expert/Expert.Component').then((m) => ({ default: m.ExpertView })),
)

function AppShell() {
  const { hub, cameras } = useAppContainer()
  useSystemStatsPolling(hub.getSystemStats)

  // The camera catalogue is state shared between screens, so it loads here rather
  // than in whichever screen happened to need it first. Without that, opening the
  // camera list directly would show it empty.
  useEffect(() => {
    void useRootStore.getState().loadCameras(cameras.getCameras)
  }, [cameras.getCameras])

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
          { path: 'cameras', element: <CameraListPage /> },
          // Names the task, not the section.
          { path: 'cameras/ajout', element: <AddCameraView />, handle: OWN_HEADER },
          {
            path: 'cameras/:cameraId',
            element: <CameraShell />,
            // Carries the name of the open camera, and its tabs.
            handle: OWN_HEADER,
            children: [
              { index: true, element: <Navigate to="detection" replace /> },
              { path: 'detection', element: <CameraDetectionPage /> },
              { path: 'conservation', element: <CameraConservationPage /> },
              { path: 'vie-privee', element: <CameraPrivacyPage /> },
              { path: 'image', element: <CameraImagePage /> },
              { path: 'connexion', element: <CameraConnectionPage /> },
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
