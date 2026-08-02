import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import './App.css'
import { AppHeader } from './common/components/AppHeader'
import { ToastProvider } from './common/components/Toast'
import { useSystemStatsPolling } from './infrastructure/store/useSystemStatsPolling'
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
  const { hub } = useAppContainer()
  useSystemStatsPolling(hub.getSystemStats)

  return (
    <div className="layout-root">
      <AppHeader />
      <Suspense fallback={null}>
        <Routes>
          {/* Consultation */}
          <Route path="/" element={<HubView />} />
          <Route path="/history" element={<DetectionHistoryView />} />

          {/* Reglages — arborescence a deux niveaux (ADR-40). Le routage porte la
              selection : c'est lui, et non un etat d'ecran, qui dit ou l'on est. */}
          <Route path="/settings" element={<SettingsView />}>
            <Route path="cameras" element={<CamerasView />} />
            <Route
              path="detection"
              element={<Navigate to="/settings/detection/personnes" replace />}
            />
            <Route path="detection/personnes" element={<ProfilesView />} />
            <Route path="conservation" element={<ConservationPage />} />
            <Route path="notifications" element={<NotificationSettingsView />} />
            <Route path="systeme" element={<SystemPage />} />
            <Route path="systeme/avance" element={<ExpertView />} />
          </Route>

          {/* Anciennes adresses : un lien garde ou un favori ne doit pas tomber
              dans le vide parce que l'arborescence a change. */}
          <Route path="/cameras" element={<Navigate to="/settings/cameras" replace />} />
          <Route
            path="/profiles"
            element={<Navigate to="/settings/detection/personnes" replace />}
          />
          <Route
            path="/notifications"
            element={<Navigate to="/settings/notifications" replace />}
          />
          <Route path="/expert" element={<Navigate to="/settings/systeme/avance" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContainerProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AppContainerProvider>
    </BrowserRouter>
  )
}

export default App
