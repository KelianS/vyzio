import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import './App.css'
import { AppHeader } from './common/components/AppHeader'
import { ToastProvider } from './common/components/Toast'
import { useSystemStatsPolling } from './infrastructure/store/useSystemStatsPolling'
import { useRootStore } from './infrastructure/store/rootStore'
import {
  AppContainerProvider,
  useAppContainer,
} from './infrastructure/providers/AppContainerContext'

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
const CamerasView = lazy(() =>
  import('./presentation/Cameras/Cameras.Component').then((m) => ({ default: m.CamerasView })),
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
const ProfilesView = lazy(() =>
  import('./presentation/Profiles/Profiles.Component').then((m) => ({ default: m.ProfilesView })),
)
const NotificationSettingsView = lazy(() =>
  import('./presentation/Notifications/Notifications.Component').then((m) => ({
    default: m.NotificationSettingsView,
  })),
)
const ConservationPage = lazy(() =>
  import('./presentation/Settings/ConservationPage').then((m) => ({ default: m.ConservationPage })),
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

  // Le catalogue de cameras est un etat partage entre ecrans : il se charge donc
  // ici, et non dans l'ecran qui se trouvait en avoir besoin le premier. Sans
  // cela, ouvrir directement la liste des cameras la montrerait vide.
  useEffect(() => {
    void useRootStore.getState().loadCameras(cameras.getCameras)
  }, [cameras.getCameras])

  return (
    <div className="layout-root">
      <AppHeader />
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
        <AppShell />
      </ToastProvider>
    </AppContainerProvider>
  )
}

// Routeur de donnees (et non `<BrowserRouter>`) : c'est ce qui donne acces a
// `useBlocker`, seul moyen d'empecher une page modifiee d'etre quittee en
// silence (ADR-41).
const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      // Consultation
      { path: '/', element: <HubView /> },
      { path: '/history', element: <DetectionHistoryView /> },

      // Reglages — arborescence a deux niveaux (ADR-40). Le routage porte la
      // selection : c'est lui, et non un etat d'ecran, qui dit ou l'on est.
      {
        path: '/settings',
        element: <SettingsView />,
        children: [
          { path: 'cameras', element: <CameraListPage /> },
          { path: 'cameras/ajout', element: <CamerasView /> },
          {
            path: 'cameras/:cameraId',
            element: <CameraShell />,
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
          { path: 'detection/personnes', element: <ProfilesView /> },
          { path: 'conservation', element: <ConservationPage /> },
          { path: 'notifications', element: <NotificationSettingsView /> },
          { path: 'systeme', element: <SystemPage /> },
          { path: 'systeme/avance', element: <ExpertView /> },
        ],
      },

      // Anciennes adresses : un lien garde ou un favori ne doit pas tomber dans
      // le vide parce que l'arborescence a change.
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
