import { describe, expect, it, vi } from 'vitest'
import { buildPrivacySettings } from './cameraPrivacySettings'
import type { Camera } from '../../domain/entities/Camera'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'

function camera(overrides: Partial<Camera> = {}): Camera {
  return {
    id: 'camera-1',
    slug: 'salon',
    displayName: 'Salon',
    sourceType: 'rtsp_manual',
    host: '192.168.1.10',
    port: 554,
    streamProtocol: 'rtsp',
    status: 'online',
    validationState: 'validated',
    isEnabled: true,
    previewAvailable: true,
    needsAttention: false,
    lastReachabilityCheckAt: null,
    lastSuccessfulFrameAt: null,
    frigateCameraName: 'salon',
    vendorFamily: null,
    privacyModeActive: false,
    privacyModeSource: null,
    privacyVendorCut: false,
    ptzSupported: true,
    privacyStrategy: 'software_blur',
    supportedProtocols: [],
    connected: true,
    verifiedCapabilities: [],
    ...overrides,
  }
}

function strategyOf(cam: Camera, parkingSaved: boolean): SettingDeclaration {
  const [setting] = buildPrivacySettings({
    camera: cam,
    parkingSaved,
    value: cam.privacyStrategy,
    onChange: vi.fn(),
  })
  return setting!
}

function offered(setting: SettingDeclaration): string[] {
  const { nature } = setting
  if (nature.kind !== 'choice') throw new Error(`Réglage sans choix (nature : ${nature.kind}).`)
  return nature.options.map((option) => option.value as string)
}

describe('buildPrivacySettings', () => {
  it('buildPrivacySettings_ShouldOfferParking_WhenTheParkingPositionIsSaved', () => {
    const setting = strategyOf(camera(), true)

    expect(offered(setting)).toContain('ptz_parking')
    expect(setting.help).not.toContain('enregistrez d’abord la position Parking')
  })

  it('buildPrivacySettings_ShouldWithholdParkingAndSayWhatUnlocksIt_WhenNoParkingPositionIsSaved', () => {
    const setting = strategyOf(camera(), false)

    expect(offered(setting)).not.toContain('ptz_parking')
    expect(setting.help).toContain('enregistrez d’abord la position Parking')
  })

  it('buildPrivacySettings_ShouldKeepParkingShown_WhenItIsAlreadyTheChosenStrategy', () => {
    expect(offered(strategyOf(camera({ privacyStrategy: 'ptz_parking' }), false))).toContain(
      'ptz_parking',
    )
  })

  it('buildPrivacySettings_ShouldSayNothingAboutParking_WhenTheCameraCannotMove', () => {
    const setting = strategyOf(camera({ ptzSupported: false }), false)

    expect(offered(setting)).not.toContain('ptz_parking')
    expect(setting.help).not.toContain('Parking')
  })
})
