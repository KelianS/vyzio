import { describe, expect, it, vi } from 'vitest'
import { buildPrivacySettings } from './cameraPrivacySettings'
import type { Camera } from '../../domain/entities/Camera'
import { makeCamera } from './cameraFixture'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'

const POSITIONS_FIRST = 'enregistrez d’abord ses positions Surveillance et Parking'

const camera = (overrides: Partial<Camera> = {}) => makeCamera({ ptzSupported: true, ...overrides })

function strategyOf(cam: Camera, positionsSaved: boolean | null): SettingDeclaration {
  const [setting] = buildPrivacySettings({
    camera: cam,
    setup: { positionsSaved },
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
  it('buildPrivacySettings_ShouldOfferParking_WhenBothPositionsAreSaved', () => {
    const setting = strategyOf(camera(), true)

    expect(offered(setting)).toContain('ptz_parking')
    expect(setting.consequence).not.toContain(POSITIONS_FIRST)
  })

  it('buildPrivacySettings_ShouldWithholdParkingAndSayWhatUnlocksIt_WhenAPositionIsMissing', () => {
    const setting = strategyOf(camera(), false)

    expect(offered(setting)).not.toContain('ptz_parking')
    expect(setting.consequence).toContain(POSITIONS_FIRST)
  })

  it('buildPrivacySettings_ShouldKeepParkingAndSayWhatIsMissing_WhenItIsAlreadyChosenWithoutPositions', () => {
    const setting = strategyOf(camera({ privacyStrategy: 'ptz_parking' }), false)

    expect(offered(setting)).toContain('ptz_parking')
    expect(setting.consequence).toContain(POSITIONS_FIRST)
  })

  it('buildPrivacySettings_ShouldNotLockParking_WhenThePositionsAreNotKnownYet', () => {
    const setting = strategyOf(camera(), null)

    expect(offered(setting)).toContain('ptz_parking')
    expect(setting.consequence).not.toContain(POSITIONS_FIRST)
  })

  it('buildPrivacySettings_ShouldSayNothingAboutParking_WhenTheCameraCannotMove', () => {
    const setting = strategyOf(camera({ ptzSupported: false }), false)

    expect(offered(setting)).not.toContain('ptz_parking')
    expect(setting.consequence).not.toContain('Parking')
  })
})
