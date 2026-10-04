import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyStrategy } from '../../domain/entities/camera.entity'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { CameraPrivacyView } from './camera_privacy.component'

const camera = makeCamera()

const PRIVACY_TAB = {
  path: '/settings/cameras/:cameraId/vie-privee',
  url: '/settings/cameras/camera-1/vie-privee',
  outletContext: camera,
}

const RULES = 'GET /api/schedules'
const PRESETS = 'GET /api/cameras/camera-1/ptz/presets'

const ptzCamera = makeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'] })

function makeRule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'rule-1',
    kind: ScheduleRuleKind.Privacy,
    targetIds: ['camera-1'],
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '22:00',
    endTime: '06:00',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('CameraPrivacyView', () => {
  it('onLoad_ShouldShowTheChoiceItsConsequenceAndThatNoRangeApplies_WhenTheSoftwareStopIsChosen', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })

    // Act
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: ptzCamera })

    // Assert
    expect(await screen.findByText('Aucune plage « Vie privée » ne s’applique')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'En mode vie privée' })).toHaveTextContent(
      'Arrêt logiciel',
    )
    expect(screen.getByText(/Rien n’est demandé à la caméra/)).toBeVisible()
    expect(screen.queryByText(/Parking/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Début')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldCountOnlyThePrivacyRangesAimingAtThisCameraAndLinkToTheCalendar_WhenTheHouseHasSeveral', async () => {
    // Arrange
    fakeNetwork({
      [RULES]: ok([
        makeRule({ id: 'here', targetIds: ['camera-1', 'camera-2'] }),
        makeRule({ id: 'elsewhere', targetIds: ['camera-2'] }),
        makeRule({
          id: 'muted',
          kind: ScheduleRuleKind.MuteNotifications,
          targetIds: ['telegram'],
        }),
      ]),
    })

    // Act
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Assert
    expect(await screen.findByText('1 plage « Vie privée » s’applique')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir la planification' })).toHaveAttribute(
      'href',
      '/settings/planification',
    )
  })

  it('onLoad_ShouldSayTheRangesCouldNotBeReadWhereTheCountWouldBe_WhenTheReadFails', async () => {
    // Arrange
    fakeNetwork({ [RULES]: failure(500) })

    // Act
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Assert
    expect(await screen.findByText('La planification n’a pas pu être lue.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('GET /api/schedules · 500')
    expect(screen.queryByText('Aucune plage « Vie privée » ne s’applique')).not.toBeInTheDocument()
  })

  it('onRetryRules_ShouldCountTheRanges_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ [RULES]: failure(500) })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    const retry = await screen.findByRole('button', { name: 'Réessayer' })
    network.answer(RULES, ok([makeRule(), makeRule({ id: 'rule-2' })]))

    // Act
    await userEvent.click(retry)

    // Assert
    expect(await screen.findByText('2 plages « Vie privée » s’appliquent')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('render_ShouldListParkingGreyedWithWhereToSaveThePositions_WhenTheyAreNotSaved', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: ptzCamera })
    await screen.findByText('Aucune plage « Vie privée » ne s’applique')
    screen.getByRole('combobox', { name: 'En mode vie privée' }).focus()

    // Act
    await userEvent.keyboard('{ArrowDown}')

    // Assert
    const parking = await screen.findByRole('option', { name: /Orientation à l’écart/ })
    expect(parking).toHaveAttribute('aria-disabled', 'true')
    expect(parking).toHaveTextContent(
      /Enregistrez d’abord ses positions Surveillance et Parking dans «\sImage et pilotage\s»/,
    )
  })

  it('onLoad_ShouldSayThePositionsCouldNotBeReadAndOfferARetry_WhenTheReadFails', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: failure(500) })

    // Act
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: ptzCamera })

    // Assert
    expect(
      await screen.findByText('Les positions de cette caméra n’ont pas pu être lues.'),
    ).toBeInTheDocument()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('GET /api/cameras/camera-1/ptz/presets · 500')
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('onRetryPresets_ShouldClearTheFailure_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ [RULES]: ok([]), [PRESETS]: failure(500) })
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: ptzCamera })
    const retry = await screen.findByRole('button', { name: 'Réessayer' })
    network.answer(PRESETS, ok({ presets: [], calibrated: true, currentPosition: null }))

    // Act
    await userEvent.click(retry)

    // Assert
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('render_ShouldSayWhatTheSavedStrategyLacks_WhenParkingIsSavedWithoutPositions', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })
    const parkedCamera = makeCamera({
      ptzSupported: true,
      verifiedCapabilities: ['ptz'],
      privacyStrategy: PrivacyStrategy.PtzParking,
    })

    // Act
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: parkedCamera })

    // Assert
    expect(
      await screen.findByText(/Enregistrez d’abord ses positions Surveillance et Parking/),
    ).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'En mode vie privée' })).toHaveTextContent(
      'Orientation à l’écart',
    )
  })

  it('onSaveStrategy_ShouldSaveTheChosenMode_WhenTheUserSaves', async () => {
    // Arrange
    const cutCamera = makeCamera({ verifiedCapabilities: ['hardware_privacy'] })
    const network = fakeNetwork({
      [RULES]: ok([]),
      'PATCH /api/cameras/camera-1/privacy-strategy': ok(cutCamera),
      'GET /api/cameras': ok([cutCamera]),
    })
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: cutCamera })
    await screen.findByText('Aucune plage « Vie privée » ne s’applique')
    // The list opens on the current mode; the next choosable one skips the greyed Parking.
    screen.getByRole('combobox', { name: 'En mode vie privée' }).focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Mode vie privée enregistré.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PATCH /api/cameras/camera-1/privacy-strategy',
        body: { strategy: PrivacyStrategy.Hardware },
      }),
    )
  })

  it('render_ShouldLeadToConnexion_WhenAParkingCameraStreamNeverWorked', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })

    // Act
    renderScreen(<CameraPrivacyView />, {
      ...PRIVACY_TAB,
      outletContext: { ...ptzCamera, status: 'to_set_up', validationState: 'to_set_up' },
    })

    // Assert
    expect(
      await screen.findByText(/s’ouvre une fois la caméra en surveillance, et son flux vidéo/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Connexion' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1/connexion',
    )
  })

  it('render_ShouldNotPromiseThePositions_WhenOrientationIsNotVerifiedYet', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })

    // Act
    renderScreen(<CameraPrivacyView />, {
      ...PRIVACY_TAB,
      outletContext: makeCamera({ ptzSupported: true, validationState: 'draft' }),
    })

    // Assert
    await screen.findByText('Aucune plage « Vie privée » ne s’applique')
    expect(screen.queryByText(/s’ouvre une fois la caméra en surveillance/)).not.toBeInTheDocument()
  })
})
