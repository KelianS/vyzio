import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
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
const DetectionHistoryView = lazy(() =>
  import('./presentation/DetectionHistory/DetectionHistory.Component').then((m) => ({
    default: m.DetectionHistoryView,
  })),
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
          <Route path="/" element={<HubView />} />
          <Route path="/cameras" element={<CamerasView />} />
          <Route path="/profiles" element={<ProfilesView />} />
          <Route path="/notifications" element={<NotificationSettingsView />} />
          <Route path="/history" element={<DetectionHistoryView />} />
          <Route path="/expert" element={<ExpertView />} />
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
