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
import { OWN_HEADER, OWN_HEADER_ONLY } from './presentation/Settings/settings.rubrics'
import { RestartSurveillanceTrigger } from './presentation/Surveillance/RestartSurveillanceTrigger'
import { NavigationGuard } from './presentation/Navigation/NavigationGuard'

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
const NotificationsPage = lazy(() =>
  import('./presentation/Notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
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
          // Nomme la tache, pas la rubrique.
          { path: 'cameras/ajout', element: <AddCameraView />, handle: OWN_HEADER },
          {
            path: 'cameras/:cameraId',
            element: <CameraShell />,
            // Porte le nom de la camera ouverte, et ses onglets.
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
          // Ecrans pas encore repris : ils portent deja un titre, jamais de
          // retour. Le marqueur tombera avec leur reprise, pas avant — sans lui
          // la page s'annoncerait deux fois.
          { path: 'detection/personnes', element: <PersonListPage /> },
          // Nomme la tache, pas la rubrique.
          { path: 'detection/personnes/ajout', element: <AddPersonPage />, handle: OWN_HEADER },
          {
            path: 'detection/personnes/:profileId',
            element: <PersonShell />,
            // Porte le nom de la personne ouverte, et ses onglets.
            handle: OWN_HEADER,
            children: [
              { index: true, element: <Navigate to="identite" replace /> },
              { path: 'identite', element: <PersonIdentityPage /> },
              { path: 'photos', element: <PersonPhotosPage /> },
              { path: 'cameras', element: <PersonCamerasPage /> },
            ],
          },
          { path: 'conservation', element: <ConservationPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'systeme', element: <SystemPage /> },
          { path: 'systeme/avance', element: <ExpertView />, handle: OWN_HEADER_ONLY },
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
