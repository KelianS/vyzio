import { useEffect, useState } from 'react'
import './App.css'
import {
  addProfilePhoto,
  applyCameraConfiguration,
  correctDetectionIdentity,
  createCamera,
  createProfile,
  dashboardRuntime,
  deleteCamera,
  deleteNotificationChannel,
  deleteProfile,
  discoverCameras,
  getCameraStatus,
  getCameras,
  getCameraDetectionConfig,
  getDetectionHistory,
  getCameraLabels,
  getNotificationLabels,
  getHubOverview,
  getNotificationChannelConfig,
  getNotificationLog,
  getProfileCameraLinks,
  getProfilePhotos,
  getProfiles,
  getSystemStats,
  getVendorAssistance,
  removeProfilePhoto,
  resyncFaceLibrary,
  saveNotificationChannelConfig,
  saveCameraDetectionConfig,
  setProfileCameraLinks,
  testNotificationChannel,
  updateCamera,
  updateProfile,
  verifyCamera,
  verifyDraftCamera,
  toggleCameraPrivacyMode,
  batchToggleCameraPrivacyMode,
  getCameraPrivacySchedules,
  createCameraPrivacySchedule,
  deleteCameraPrivacySchedule,
  setPrivacyStrategy,
  ptzStep,
  ptzGoToPreset,
  configurePtzParking,
} from './app/dependencies'
import { useHubOverview } from './ui/hooks/useHubOverview'
import { useCameras } from './ui/hooks/useCameras'
import { AppHeader } from './ui/components/AppHeader'
import { ToastProvider } from './ui/components/Toast'
import { CameraOnboardingView } from './ui/components/CameraOnboardingView'
import { DetectionHistoryView } from './ui/components/DetectionHistoryView'
import { ExpertView } from './ui/components/ExpertView'
import { NotificationSettingsView } from './ui/components/NotificationSettingsView'
import { ProfilesView } from './ui/components/ProfilesView'
import { HubView } from './ui/components/HubView'
import { LiveFeedModal } from './ui/components/LiveFeedModal'

type AppView = 'hub' | 'cameras' | 'notifications' | 'profiles' | 'history' | 'expert'

function App() {
  const [view, setView] = useState<AppView>(() => getViewFromHash(window.location.hash))
  const { data, loading: hubLoading, error: hubError } = useHubOverview(getHubOverview)
  const { data: cameras, loading: camerasLoading, reload: reloadCameras } = useCameras(getCameras)
  const [modalMedia, setModalMedia] = useState<
    | { type: 'image' | 'video'; url: string }
    | {
        type: 'live'
        cameraId: string
        apiBaseUrl: string
        label: string
        ptzSupported: boolean
        onClose?: () => Promise<void>
      }
    | null
  >(null)

  const handleCloseModal = async () => {
    if (modalMedia?.type === 'live' && modalMedia.onClose) {
      await modalMedia.onClose()
    }
    setModalMedia(null)
  }

  useEffect(() => {
    const handleHashChange = () => {
      setView(getViewFromHash(window.location.hash))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigateBack = () => {
    window.location.hash = ''
    setView('hub')
  }

  return (
    <ToastProvider>
      <div className="layout-root">
        <AppHeader currentView={view} />

        {view === 'cameras' && (
          <CameraOnboardingView
            getCameras={getCameras}
            getCameraStatus={getCameraStatus}
            discoverCameras={discoverCameras}
            getVendorAssistance={getVendorAssistance}
            createCamera={createCamera}
            updateCamera={updateCamera}
            verifyDraftCamera={verifyDraftCamera}
            verifyCamera={verifyCamera}
            applyCameraConfiguration={applyCameraConfiguration}
            deleteCamera={deleteCamera}
            getCameraDetectionConfig={getCameraDetectionConfig}
            saveCameraDetectionConfig={saveCameraDetectionConfig}
            getCameraLabels={getCameraLabels}
            getPrivacySchedules={getCameraPrivacySchedules}
            createPrivacySchedule={createCameraPrivacySchedule}
            deletePrivacySchedule={deleteCameraPrivacySchedule}
            setPrivacyStrategy={setPrivacyStrategy}
            ptzStep={ptzStep}
            ptzGoToPreset={ptzGoToPreset}
            configurePtzParking={configurePtzParking}
            allCameras={cameras}
            apiBaseUrl={dashboardRuntime.apiBaseUrl}
            onOpenLive={(camera, options) =>
              setModalMedia({
                type: 'live',
                cameraId: camera.id,
                apiBaseUrl: dashboardRuntime.apiBaseUrl,
                label: camera.displayName,
                ptzSupported: camera.ptzSupported,
                onClose: options?.onClose,
              })
            }
          />
        )}

        {view === 'notifications' && (
          <NotificationSettingsView
            getNotificationChannelConfig={getNotificationChannelConfig}
            saveNotificationChannelConfig={saveNotificationChannelConfig}
            testNotificationChannel={testNotificationChannel}
            deleteNotificationChannel={deleteNotificationChannel}
            getNotificationLog={getNotificationLog}
            getNotificationLabels={getNotificationLabels}
            onBack={navigateBack}
          />
        )}

        {view === 'profiles' && (
          <ProfilesView
            getProfiles={getProfiles}
            createProfile={createProfile}
            updateProfile={updateProfile}
            deleteProfile={deleteProfile}
            getProfilePhotos={getProfilePhotos}
            addProfilePhoto={addProfilePhoto}
            removeProfilePhoto={removeProfilePhoto}
            getProfileCameraLinks={getProfileCameraLinks}
            setProfileCameraLinks={setProfileCameraLinks}
            resyncFaceLibrary={resyncFaceLibrary}
            apiBaseUrl={dashboardRuntime.apiBaseUrl}
            onBack={navigateBack}
          />
        )}

        {view === 'history' && (
          <DetectionHistoryView
            getDetectionHistory={getDetectionHistory}
            getCameraLabels={getCameraLabels}
            correctDetectionIdentity={correctDetectionIdentity}
            getProfiles={getProfiles}
            apiBaseUrl={dashboardRuntime.apiBaseUrl}
            onBack={navigateBack}
          />
        )}

        {view === 'expert' && <ExpertView frigateBaseUrl={dashboardRuntime.frigateBaseUrl} />}

        {view === 'hub' && (
          <HubView
            hubLoading={hubLoading}
            camerasLoading={camerasLoading}
            hubError={hubError}
            data={data}
            cameras={cameras}
            apiBaseUrl={dashboardRuntime.apiBaseUrl}
            getSystemStats={getSystemStats}
            onOpenMedia={(type, url) => setModalMedia({ type, url })}
            onOpenLive={(camera) =>
              setModalMedia({
                type: 'live',
                cameraId: camera.id,
                apiBaseUrl: dashboardRuntime.apiBaseUrl,
                label: camera.displayName,
                ptzSupported: camera.ptzSupported,
              })
            }
            onTogglePrivacy={async (camera, active) => {
              await toggleCameraPrivacyMode.execute(camera.id, active)
              reloadCameras()
            }}
            onBatchTogglePrivacy={async (cameraIds, active) => {
              await batchToggleCameraPrivacyMode.execute(cameraIds, active)
              reloadCameras()
            }}
          />
        )}

        {modalMedia && (
          <div
            onClick={() => {
              void handleCloseModal()
            }}
            className="media-modal-backdrop"
          >
            <div onClick={(e) => e.stopPropagation()} className="media-modal-content">
              <button
                type="button"
                onClick={() => {
                  void handleCloseModal()
                }}
                className="media-modal-close"
              >
                ✕
              </button>
              {modalMedia.type === 'live' ? (
                <LiveFeedModal
                  cameraId={modalMedia.cameraId}
                  apiBaseUrl={modalMedia.apiBaseUrl}
                  label={modalMedia.label}
                  ptzSupported={modalMedia.ptzSupported}
                  ptzStep={ptzStep}
                  ptzGoToPreset={ptzGoToPreset}
                />
              ) : modalMedia.type === 'image' ? (
                <img src={modalMedia.url} alt="Aperçu détection" className="media-modal-media" />
              ) : (
                <video src={modalMedia.url} controls autoPlay className="media-modal-media" />
              )}
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}

function getViewFromHash(hash: string): AppView {
  if (hash === '#cameras') return 'cameras'
  if (hash === '#notifications') return 'notifications'
  if (hash === '#profiles') return 'profiles'
  if (hash === '#history') return 'history'
  if (hash === '#expert') return 'expert'
  return 'hub'
}

export default App
