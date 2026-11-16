import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyMiss, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { CameraPrivacyView } from './camera_privacy.component'

const camera = makeCamera()

const PRIVACY_TAB = {
  path: '/settings/cameras/:cameraId/privacy',
  url: '/settings/cameras/camera-1/privacy',
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
    expect(await screen.findByRole('link', { name: 'Planification' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'En mode vie privée' })).toHaveTextContent(
      'Arrêt logiciel',
    )
    expect(
      screen.getByText('Vyzio s’arrête, la caméra filme toujours, visible sur votre réseau local.'),
    ).toBeVisible()
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
    expect(await screen.findByRole('link', { name: 'Planification 1 plage' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Planification/ })).toHaveAttribute(
      'href',
      '/settings/schedule',
    )
  })

  it('onLoad_ShouldSayUntilWhenTheSurveillanceIsResumed_WhenItWasResumedInsideARange', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([makeRule()]) })
    const resumed = makeCamera({ privacyResume: { until: { dayOfWeek: 2, time: '06:00' } } })

    // Act
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: resumed })

    // Assert
    expect(
      await screen.findByText(
        'Surveillance reprise jusqu’à la fin de la plage, mardi à 06:00, heure de la maison.',
      ),
    ).toBeInTheDocument()
  })

  it('onLoad_ShouldSayNothingOfAResume_WhenTheSurveillanceWasNotResumed', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([makeRule()]) })

    // Act
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Assert
    expect(await screen.findByRole('link', { name: 'Planification 1 plage' })).toBeInTheDocument()
    expect(screen.queryByText(/Surveillance reprise/)).not.toBeInTheDocument()
  })

  it('onLoad_ShouldSayTheRangesCouldNotBeReadWhereTheCountWouldBe_WhenTheReadFails', async () => {
    // Arrange
    fakeNetwork({ [RULES]: failure(500) })

    // Act
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Assert
    expect(await screen.findByText('La planification n’a pas pu être lue.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('GET /api/schedules · 500')
    expect(screen.queryByRole('link', { name: /Planification/ })).not.toBeInTheDocument()
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
    expect(await screen.findByRole('link', { name: 'Planification 2 plages' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('render_ShouldListParkingGreyedWithWhereToSaveThePositions_WhenTheyAreNotSaved', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: ptzCamera })
    await screen.findByRole('link', { name: 'Planification' })
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

  it('onRetryPrivacy_ShouldAskTheCameraAgainAndSaySoWhenItFollows_WhenTheRequestWasInterrupted', async () => {
    // Arrange
    const missed = makeCamera({
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.Unconfirmed,
    })
    const followed = { ...missed, privacyMiss: null }
    const network = fakeNetwork({
      [RULES]: ok([]),
      'POST /api/cameras/camera-1/privacy/retry': ok(followed),
      'GET /api/cameras': ok([followed]),
    })
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: missed })
    await screen.findByText('La caméra ne s’est peut-être pas tournée')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByText('La caméra a suivi.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: 'POST /api/cameras/camera-1/privacy/retry' }),
    )
  })

  it('onRetryPrivacy_ShouldSayTheNewMissAndItsDetail_WhenTheCameraStillDoesNotFollow', async () => {
    // Arrange
    const missed = makeCamera({
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.Unconfirmed,
    })
    const failed = {
      ...missed,
      privacyMiss: PrivacyMiss.CameraFailed,
      privacyMissDetail:
        'privacy on, ptz_parking: CameraUnreachableException: ONVIF Ptz: no answer',
    }
    fakeNetwork({
      [RULES]: ok([]),
      'POST /api/cameras/camera-1/privacy/retry': ok(failed),
      'GET /api/cameras': ok([failed]),
    })
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: missed })
    await screen.findByText('La caméra ne s’est peut-être pas tournée')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByText('La caméra ne s’est pas tournée.')).toBeInTheDocument()
    expect(screen.getAllByText(/ONVIF Ptz: no answer/).length).toBeGreaterThan(0)
  })

  it('onRetryPrivacy_ShouldSayTheRequestFailed_WhenTheHubRefusesIt', async () => {
    // Arrange
    const missed = makeCamera({
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.CameraFailed,
    })
    fakeNetwork({
      [RULES]: ok([]),
      'POST /api/cameras/camera-1/privacy/retry': failure(500),
    })
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: missed })
    await screen.findByText('La caméra ne s’est pas tournée')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(
      await screen.findByText(/POST \/api\/cameras\/camera-1\/privacy\/retry · 500/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled()
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
    await screen.findByRole('link', { name: 'Planification' })
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
      outletContext: {
        ...ptzCamera,
        privacyStrategy: 'ptz_parking',
        status: 'to_set_up',
        validationState: 'to_set_up',
      },
    })

    // Assert
    expect(
      await screen.findByText(
        /^Positions réglables une fois son flux vidéo reçu : voir « Connexion »/,
      ),
    ).toBeInTheDocument()
  })

  it('render_ShouldPointAtTheHeaderTrigger_WhenAParkingCameraWaitsForTheRestart', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })

    // Act
    renderScreen(<CameraPrivacyView />, {
      ...PRIVACY_TAB,
      outletContext: { ...ptzCamera, privacyStrategy: 'ptz_parking', validationState: 'draft' },
    })

    // Assert
    expect(
      await screen.findByText(/^Positions réglables une fois les changements appliqués, en haut/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Enregistrez d’abord ses positions/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Appliquer les changements' }),
    ).not.toBeInTheDocument()
  })

  it('render_ShouldListParkingGreyedWithWhatItWaitsFor_WhenTheCameraIsNotInSurveillanceYet', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })
    renderScreen(<CameraPrivacyView />, {
      ...PRIVACY_TAB,
      outletContext: { ...ptzCamera, validationState: 'draft' },
    })
    await screen.findByRole('link', { name: 'Planification' })
    screen.getByRole('combobox', { name: 'En mode vie privée' }).focus()

    // Act
    await userEvent.keyboard('{ArrowDown}')

    // Assert
    const parking = await screen.findByRole('option', { name: /Orientation à l’écart/ })
    expect(parking).toHaveAttribute('aria-disabled', 'true')
    expect(parking).toHaveTextContent(/une fois les changements appliqués/)
  })

  it('render_ShouldNotPromiseThePositions_WhenOrientationIsNotVerifiedYet', async () => {
    // Arrange
    fakeNetwork({ [RULES]: ok([]), [PRESETS]: ok({ presets: [], calibrated: true }) })

    // Act
    renderScreen(<CameraPrivacyView />, {
      ...PRIVACY_TAB,
      outletContext: makeCamera({
        ptzSupported: true,
        privacyStrategy: 'ptz_parking',
        validationState: 'draft',
      }),
    })

    // Assert
    await screen.findByRole('link', { name: 'Planification' })
    expect(screen.queryByText(/^Positions réglables/)).not.toBeInTheDocument()
  })
})
