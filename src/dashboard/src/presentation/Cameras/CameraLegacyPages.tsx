import { useOutletContext } from 'react-router'
import type { Camera } from '../../domain/entities/Camera'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import { SettingsPanel } from '../Settings/SettingsPanel'
import { CapabilitySection } from './CapabilitySection'
import { ImageSettingsPanel } from './ImageSettingsPanel'
import { PrivacyScheduleSection } from './PrivacyScheduleSection'
import { PtzPresetsSection } from './PtzPresetsSection'

/**
 * Pages de camera qui hebergent, telles quelles, des sections non encore
 * reprises. Elles sont **rangees** au bon endroit de l'arborescence sans etre
 * reecrites : la coquille d'abord, le contenu ensuite (ADR-40).
 *
 * Ces sections gardent donc pour l'instant leurs propres boutons et leurs
 * enregistrements immediats, au lieu du cycle en deux temps d'ADR-41. C'est
 * visible, c'est temporaire, et c'est le prochain lot.
 */
function useCamera(): Camera {
  return useOutletContext<Camera>()
}

export function CameraPrivacyPage() {
  const camera = useCamera()
  const allCameras = useRootStore((state) => state.cameras)
  const { cameras: container } = useAppContainer()

  return (
    <SettingsPanel title="Vie privée" lede="Ce que Vyzio fait quand vous ne voulez pas être filmé.">
      <PrivacyScheduleSection
        camera={camera}
        cameraId={camera.id}
        allCameras={allCameras}
        getSchedules={container.getCameraPrivacySchedules}
        createSchedule={container.createCameraPrivacySchedule}
        deleteSchedule={container.deleteCameraPrivacySchedule}
      />
    </SettingsPanel>
  )
}

export function CameraImagePage() {
  const camera = useCamera()
  const { apiBaseUrl, cameras: container } = useAppContainer()

  return (
    <div className="flex flex-col gap-4">
      {camera.verifiedCapabilities.includes('image_settings') && (
        <SettingsPanel title="Image" lede="Ce que la caméra envoie, avant toute analyse.">
          <ImageSettingsPanel camera={camera} />
        </SettingsPanel>
      )}

      {camera.ptzSupported && (
        <SettingsPanel title="Pilotage" lede="Positions enregistrées et calibration.">
          <PtzPresetsSection
            cameraId={camera.id}
            apiBaseUrl={apiBaseUrl}
            getPtzPresets={container.getPtzPresets}
            ptzSaveCurrentAsPreset={container.ptzSaveCurrentAsPreset}
            ptzGoToPreset={container.ptzGoToPreset}
            ptzCalibrate={container.ptzCalibrate}
            capturePtzPresetThumbnail={container.capturePtzPresetThumbnail}
          />
        </SettingsPanel>
      )}

      {!camera.verifiedCapabilities.includes('image_settings') && !camera.ptzSupported && (
        <SettingsPanel title="Image et pilotage">
          <p className="text-sm text-muted-foreground">
            Cette caméra n’expose ni réglages d’image ni pilotage.
          </p>
        </SettingsPanel>
      )}
    </div>
  )
}

export function CameraConnectionPage() {
  const camera = useCamera()

  return (
    <SettingsPanel
      title="Connexion"
      lede="Comment Vyzio joint cette caméra, et ce dont elle est capable."
    >
      <CapabilitySection camera={camera} />
    </SettingsPanel>
  )
}
