import { describe, expect, it, vi } from 'vitest'
import { buildPrivacySettings } from './camera_privacy_settings'
import { PrivacyStrategy, type Camera } from '../../domain/entities/camera.entity'
import { makeCamera } from '../../testing/camera_fixture'
import type { ChoiceOption, SettingDeclaration } from '../../common/settings/setting_declaration'

const POSITIONS_FIRST = 'Enregistrez d’abord ses positions Surveillance et Parking'
const ORIENTATION_UNVERIFIED = 'L’orientation de cette caméra n’est pas vérifiée'
const ORIENTATION_OFF = 'L’orientation de cette caméra est désactivée'
const HARDWARE_UNVERIFIED = 'Aucune coupure matérielle vérifiée sur cette caméra'

const camera = (overrides: Partial<Camera> = {}) =>
  makeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'], ...overrides })

function strategyOf(cam: Camera, positionsSaved: boolean | null): SettingDeclaration {
  const [setting] = buildPrivacySettings({
    camera: cam,
    setup: { positionsSaved },
    value: cam.privacyStrategy,
    onChange: vi.fn(),
  })
  return setting!
}

function optionOf(setting: SettingDeclaration, value: PrivacyStrategy): ChoiceOption | undefined {
  const { nature } = setting
  if (nature.kind !== 'choice') throw new Error(`Réglage sans choix (nature : ${nature.kind}).`)
  return nature.options.find((option) => option.value === value)
}

describe('buildPrivacySettings', () => {
  it('buildPrivacySettings_ShouldListEveryStrategy_WhenTheCameraCannotTurnNorCutItsLens', () => {
    // Arrange & Act
    const setting = strategyOf(camera({ ptzSupported: false, verifiedCapabilities: [] }), null)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.None)).toBeDefined()
    expect(optionOf(setting, PrivacyStrategy.SoftwareBlur)).toBeDefined()
    expect(optionOf(setting, PrivacyStrategy.PtzParking)).toBeDefined()
    expect(optionOf(setting, PrivacyStrategy.Hardware)).toBeDefined()
  })

  it('buildPrivacySettings_ShouldOfferParking_WhenBothPositionsAreSaved', () => {
    // Arrange & Act
    const setting = strategyOf(camera(), true)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.PtzParking)?.unavailable).toBeUndefined()
  })

  it('buildPrivacySettings_ShouldGreyParkingAndSayWhereToSaveThePositions_WhenAPositionIsMissing', () => {
    // Arrange & Act
    const setting = strategyOf(camera(), false)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.PtzParking)?.unavailable).toContain(POSITIONS_FIRST)
    expect(optionOf(setting, PrivacyStrategy.PtzParking)?.unavailable).toContain(
      '« Image et pilotage »',
    )
  })

  it('buildPrivacySettings_ShouldGreyParkingAndPointToConnexion_WhenTheOrientationIsNotVerified', () => {
    // Arrange & Act
    const setting = strategyOf(camera({ verifiedCapabilities: [] }), null)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.PtzParking)?.unavailable).toContain(
      ORIENTATION_UNVERIFIED,
    )
  })

  it('buildPrivacySettings_ShouldGreyParkingAndPointToConnexion_WhenTheOrientationIsSwitchedOff', () => {
    // Arrange & Act
    const setting = strategyOf(camera({ ptzSupported: false }), null)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.PtzParking)?.unavailable).toContain(ORIENTATION_OFF)
  })

  it('buildPrivacySettings_ShouldNotLockParking_WhenThePositionsAreNotKnownYet', () => {
    // Arrange & Act
    const setting = strategyOf(camera(), null)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.PtzParking)?.unavailable).toBeUndefined()
  })

  it('buildPrivacySettings_ShouldGreyTheHardwareCut_WhenItIsNotVerified', () => {
    // Arrange & Act
    const setting = strategyOf(camera({ vendorFamily: 'tplink_tapo' }), true)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.Hardware)?.unavailable).toContain(HARDWARE_UNVERIFIED)
  })

  it('buildPrivacySettings_ShouldOfferTheHardwareCut_WhenItIsVerified', () => {
    // Arrange & Act
    const setting = strategyOf(camera({ verifiedCapabilities: ['hardware_privacy'] }), true)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.Hardware)?.unavailable).toBeUndefined()
  })

  it('buildPrivacySettings_ShouldSayOnlyWhatNoneDoes_WhenNoneIsChosenAndParkingIsLocked', () => {
    // Arrange & Act
    const setting = strategyOf(camera({ privacyStrategy: PrivacyStrategy.None }), false)

    // Assert
    expect(setting.consequence).toContain('Rien n’est demandé à la caméra')
    expect(setting.consequence).not.toContain('Parking')
  })

  it('buildPrivacySettings_ShouldKeepItChoosableAndSayWhatIsMissing_WhenParkingIsSavedWithoutPositions', () => {
    // Arrange & Act
    const setting = strategyOf(camera({ privacyStrategy: PrivacyStrategy.PtzParking }), false)

    // Assert
    expect(optionOf(setting, PrivacyStrategy.PtzParking)?.unavailable).toBeUndefined()
    expect(setting.consequence).not.toContain('pivote vers sa position Parking')
    expect(setting.consequence).toContain('seul Vyzio s’arrête')
    expect(setting.consequence).toContain(POSITIONS_FIRST)
  })

  it('buildPrivacySettings_ShouldSayWhatIsMissing_WhenTheHardwareCutIsChosenButNotVerified', () => {
    // Arrange & Act
    const setting = strategyOf(camera({ privacyStrategy: PrivacyStrategy.Hardware }), null)

    // Assert
    expect(setting.consequence).toContain(HARDWARE_UNVERIFIED)
  })
})
