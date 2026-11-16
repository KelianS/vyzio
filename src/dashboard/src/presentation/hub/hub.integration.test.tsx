import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyMiss, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { makeDetectionEvent } from '../../testing/detection_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import type { Silence } from '../../domain/entities/silence.entity'
import { HubView } from './hub.component'

const SILENCE = '/api/notifications/silence'
const CUT = '/api/cameras/privacy/cut'

const overview = {
  systemHealthy: true,
  recentEvents: [],
  profiles: [],
  notifications: { activeChannels: 1, sentCount: 0, lastSentAt: null },
  warnings: [],
}

const NO_SILENCE: Silence = { active: false, until: null, scheduleNextChange: null }

/** Two hours ahead, read as 23 h: within a day, so the hour alone. */
const inTwoHours = (time: string) => ({
  at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  dayOfWeek: 1,
  time,
})

const home = (routes: Record<string, ReturnType<typeof ok>> = {}) =>
  fakeNetwork({
    'GET /api/hub/overview': ok(overview),
    'GET /api/detection-events/history': ok({ items: [], nextCursor: null }),
    [`GET ${SILENCE}`]: ok(NO_SILENCE),
    [`GET ${CUT}`]: ok({ scheduleNextChange: null }),
    'GET /api/cameras': ok([makeCamera()]),
    ...routes,
  })

const fourCameras = ['Porte', 'Jardin', 'Garage', 'Salon', 'Cave'].map((name, index) =>
  makeCamera({ id: `camera-${index + 1}`, slug: name.toLowerCase(), displayName: name }),
)

describe('HubView', () => {
  it('render_ShouldShowEachCameraLargeWithItsMarkAndEye_WhenThereAreFewerThanFour', async () => {
    // Arrange
    home()

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByRole('link', { name: 'Front Door' })).toHaveAttribute(
      'href',
      '/cameras/camera-1',
    )
    expect(screen.getByRole('img', { name: 'En marche' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Couper Front Door' })).toBeInTheDocument()
    expect(screen.queryByText(/Voir les/)).not.toBeInTheDocument()
  })

  it('render_ShouldShowTheFirstFourAndLeadToTheOthers_WhenThereAreFourOrMore', async () => {
    // Arrange
    home({ 'GET /api/cameras': ok(fourCameras) })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByRole('link', { name: 'Voir les 5 caméras' })).toHaveAttribute(
      'href',
      '/cameras',
    )
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.queryByText('Cave')).not.toBeInTheDocument()
  })

  it('onTogglePrivacy_ShouldCutTheCameraWithoutAsking_WhenTheUserTapsItsEye', async () => {
    // Arrange
    const network = home({
      'POST /api/cameras/privacy/batch-toggle': ok([makeCamera({ privacyModeActive: true })]),
    })
    renderScreen(<HubView />)
    const eye = await screen.findByRole('button', { name: 'Couper Front Door' })
    network.answer('GET /api/cameras', ok([makeCamera({ privacyModeActive: true })]))

    // Act
    await userEvent.click(eye)

    // Assert
    expect(await screen.findByRole('button', { name: 'Réactiver Front Door' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(network.sent).toContainEqual({
      route: 'POST /api/cameras/privacy/batch-toggle',
      query: '',
      body: { cameraIds: ['camera-1'], active: true },
    })
  })

  it('onCutCameras_ShouldCutEveryCameraUntilResumedAndClose_WhenTheUserPicksUntilReactivation', async () => {
    // Arrange
    const network = home({
      'GET /api/cameras': ok([makeCamera(), makeCamera({ id: 'camera-2', slug: 'garden' })]),
      [`PUT ${CUT}`]: ok([]),
    })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Couper les caméras' }))
    const sheet = await screen.findByRole('dialog', { name: 'Couper les caméras' })
    network.answer(
      'GET /api/cameras',
      ok([
        makeCamera({ privacyModeActive: true }),
        makeCamera({ id: 'camera-2', slug: 'garden', privacyModeActive: true }),
      ]),
    )

    // Act
    await userEvent.click(within(sheet).getByRole('button', { name: 'Jusqu’à réactivation' }))

    // Assert
    expect(await screen.findByRole('button', { name: 'Réactiver les caméras' })).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(network.sent).toContainEqual({ route: `PUT ${CUT}`, query: '', body: {} })
  })

  it('onOpenCut_ShouldOfferUntilResumedThenTheScheduleChangeThenTheDurations_WhenAPrivacyRangeExists', async () => {
    // Arrange
    home({ [`GET ${CUT}`]: ok({ scheduleNextChange: inTwoHours('23:00') }) })
    renderScreen(<HubView />)

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Couper les caméras' }))

    // Assert
    const sheet = await screen.findByRole('dialog', { name: 'Couper les caméras' })
    expect(
      within(sheet)
        .getAllByRole('button')
        .map((option) => option.textContent),
    ).toEqual([
      'Jusqu’à réactivation',
      'Jusqu’à 23 hEnsuite, la planification reprend',
      '30 minutes',
      '1 heure',
      '2 heures',
      '4 heures',
      'Annuler',
    ])
  })

  it('onCutCameras_ShouldSayUntilWhenEveryCameraIsCut_WhenADurationIsPicked', async () => {
    // Arrange
    const until = inTwoHours('23:00')
    const network = home({ [`PUT ${CUT}`]: ok([]) })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Couper les caméras' }))
    network.answer(
      'GET /api/cameras',
      ok([makeCamera({ privacyModeActive: true, privacyCutUntil: until })]),
    )

    // Act
    await userEvent.click(await screen.findByRole('button', { name: '2 heures' }))

    // Assert
    expect(
      await screen.findByRole('button', { name: 'Caméras coupées jusqu’à 23 h' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(network.sent).toContainEqual({ route: `PUT ${CUT}`, query: '', body: { minutes: 120 } })
  })

  it('onTogglePrivacy_ShouldResumeEveryCameraAtOnce_WhenTheUserTapsTheTimedCut', async () => {
    // Arrange
    const until = inTwoHours('23:00')
    const network = home({
      'GET /api/cameras': ok([
        makeCamera({ privacyModeActive: true, privacyCutUntil: until }),
        makeCamera({
          id: 'camera-2',
          slug: 'garden',
          privacyModeActive: true,
          privacyCutUntil: until,
        }),
      ]),
      'POST /api/cameras/privacy/batch-toggle': ok([]),
    })
    renderScreen(<HubView />)
    const pill = await screen.findByRole('button', { name: 'Caméras coupées jusqu’à 23 h' })
    network.answer(
      'GET /api/cameras',
      ok([makeCamera(), makeCamera({ id: 'camera-2', slug: 'garden' })]),
    )

    // Act
    await userEvent.click(pill)

    // Assert
    expect(await screen.findByRole('button', { name: 'Couper les caméras' })).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(network.sent).toContainEqual({
      route: 'POST /api/cameras/privacy/batch-toggle',
      query: '',
      body: { cameraIds: ['camera-1', 'camera-2'], active: false },
    })
  })

  it('onTogglePrivacy_ShouldKeepTheCameraAsItWasAndSayWhy_WhenTheCameraDoesNotAnswer', async () => {
    // Arrange
    home({
      'POST /api/cameras/privacy/batch-toggle': failure(
        502,
        'camera_unreachable',
        'DVRIP: no answer',
      ),
    })
    renderScreen(<HubView />)

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Couper Front Door' }))

    // Assert
    expect(await screen.findByText(/La caméra ne répond pas/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Couper Front Door' })).toBeEnabled()
  })

  it('onTogglePrivacy_ShouldSayInAToastThatTheCameraDidNotTurnWithItsDetail_WhenItDidNotFollow', async () => {
    // Arrange
    const missed = makeCamera({
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.CameraFailed,
      privacyMissDetail: 'privacy on, ptz_parking: ONVIF Ptz: no answer',
    })
    const network = home({ 'POST /api/cameras/privacy/batch-toggle': ok([missed]) })
    renderScreen(<HubView />)
    const eye = await screen.findByRole('button', { name: 'Couper Front Door' })
    network.answer('GET /api/cameras', ok([missed]))

    // Act
    await userEvent.click(eye)

    // Assert
    const toast = within(await screen.findByRole('region', { name: 'Notifications' }))
    expect(
      await toast.findByText('Front Door : la caméra ne s’est pas tournée.'),
    ).toBeInTheDocument()
    expect(toast.getByText('privacy on, ptz_parking: ONVIF Ptz: no answer')).toBeInTheDocument()
    expect(toast.getByRole('button', { name: 'Réessayer' })).toBeEnabled()
  })

  it('onTogglePrivacy_ShouldAskTheCameraAgainAndSaySoWhenItFollows_WhenTheUserRetriesFromTheToast', async () => {
    // Arrange
    const missed = makeCamera({
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.Unconfirmed,
    })
    const followed = { ...missed, privacyMiss: null }
    const network = home({
      'POST /api/cameras/privacy/batch-toggle': ok([missed]),
      'POST /api/cameras/camera-1/privacy/retry': ok(followed),
    })
    renderScreen(<HubView />)
    const eye = await screen.findByRole('button', { name: 'Couper Front Door' })
    network.answer('GET /api/cameras', ok([missed]))
    await userEvent.click(eye)
    await screen.findByText('Front Door : la caméra ne s’est peut-être pas tournée.')
    network.answer('GET /api/cameras', ok([followed]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByText('Front Door : la caméra a suivi.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: 'POST /api/cameras/camera-1/privacy/retry' }),
    )
  })

  it('onTogglePrivacy_ShouldSayWhatIsMissingWithoutARetry_WhenNoParkingPositionIsSaved', async () => {
    // Arrange
    const missed = makeCamera({
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.PositionMissing,
    })
    const network = home({ 'POST /api/cameras/privacy/batch-toggle': ok([missed]) })
    renderScreen(<HubView />)
    const eye = await screen.findByRole('button', { name: 'Couper Front Door' })
    network.answer('GET /api/cameras', ok([missed]))

    // Act
    await userEvent.click(eye)

    // Assert
    expect(
      await screen.findByText(
        'Front Door : la caméra ne s’est pas tournée, sa position Parking n’est pas enregistrée.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onTogglePrivacy_ShouldTellNoMiss_WhenTheCameraIsOffline', async () => {
    // Arrange
    const offline = makeCamera({
      status: 'offline',
      connected: false,
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.CameraFailed,
    })
    const network = home({ 'POST /api/cameras/privacy/batch-toggle': ok([offline]) })
    renderScreen(<HubView />)
    const eye = await screen.findByRole('button', { name: 'Couper Front Door' })
    network.answer('GET /api/cameras', ok([offline]))

    // Act
    await userEvent.click(eye)

    // Assert
    expect(await screen.findByRole('button', { name: 'Réactiver Front Door' })).toBeEnabled()
    expect(screen.queryByText(/ne s’est pas tournée/)).not.toBeInTheDocument()
  })

  it('onCutCameras_ShouldSayEachCameraThatDidNotTurn_WhenTheUserCutsThemAll', async () => {
    // Arrange
    const missed = makeCamera({
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.CameraFailed,
    })
    const network = home({ [`PUT ${CUT}`]: ok([]) })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Couper les caméras' }))
    const sheet = await screen.findByRole('dialog', { name: 'Couper les caméras' })
    network.answer('GET /api/cameras', ok([missed]))

    // Act
    await userEvent.click(within(sheet).getByRole('button', { name: 'Jusqu’à réactivation' }))

    // Assert
    expect(
      await screen.findByText('Front Door : la caméra ne s’est pas tournée.'),
    ).toBeInTheDocument()
  })

  it('onStartSilence_ShouldOfferTheScheduleChangeFirstThenStartAndClose_WhenAMuteRangeExists', async () => {
    // Arrange
    const nextChange = inTwoHours('23:00')
    const network = home({
      [`GET ${SILENCE}`]: ok({ ...NO_SILENCE, scheduleNextChange: nextChange }),
      [`PUT ${SILENCE}`]: ok({ active: true, until: nextChange, scheduleNextChange: nextChange }),
    })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Silence' }))
    const sheet = await screen.findByRole('dialog', { name: 'Silence' })
    const options = within(sheet).getAllByRole('button')
    expect(options.map((option) => option.textContent)).toEqual([
      'Jusqu’à réactivation',
      'Jusqu’à 23 hEnsuite, la planification reprend',
      '30 minutes',
      '1 heure',
      '2 heures',
      '4 heures',
      'Annuler',
    ])

    // Act
    await userEvent.click(options[1])

    // Assert
    expect(await screen.findByRole('button', { name: 'Silence jusqu’à 23 h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('En silence jusqu’à 23 h')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(network.sent).toContainEqual({
      route: `PUT ${SILENCE}`,
      query: '',
      body: { until: nextChange.at },
    })
  })

  it('onStartSilence_ShouldOfferTheDurationsOnly_WhenNoMuteRangeExists', async () => {
    // Arrange
    const network = home({
      [`PUT ${SILENCE}`]: ok({
        active: true,
        until: inTwoHours('23:00'),
        scheduleNextChange: null,
      }),
    })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Silence' }))
    const sheet = await screen.findByRole('dialog', { name: 'Silence' })
    expect(within(sheet).queryByText(/planification/)).not.toBeInTheDocument()

    // Act
    await userEvent.click(within(sheet).getByRole('button', { name: '30 minutes' }))

    // Assert
    expect(await screen.findByRole('button', { name: 'Silence jusqu’à 23 h' })).toBeVisible()
    expect(network.sent).toContainEqual({
      route: `PUT ${SILENCE}`,
      query: '',
      body: { minutes: 30 },
    })
  })

  it('onStartSilence_ShouldSayTheSilenceHoldsWithNoHour_WhenTheUserPicksUntilReactivation', async () => {
    // Arrange
    const network = home({
      [`PUT ${SILENCE}`]: ok({ active: true, until: null, scheduleNextChange: null }),
    })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Silence' }))

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Jusqu’à réactivation' }))

    // Assert
    expect(await screen.findByRole('button', { name: 'Silence activé' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('En silence')).toBeInTheDocument()
    expect(network.sent).toContainEqual({ route: `PUT ${SILENCE}`, query: '', body: {} })
  })

  it('onStopSilence_ShouldEndTheSilenceAtOnce_WhenTheUserTapsTheAmberPill', async () => {
    // Arrange
    const network = home({
      [`GET ${SILENCE}`]: ok({
        active: true,
        until: inTwoHours('23:00'),
        scheduleNextChange: null,
      }),
      [`DELETE ${SILENCE}`]: ok(NO_SILENCE),
    })
    renderScreen(<HubView />)

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Silence jusqu’à 23 h' }))

    // Assert
    expect(await screen.findByRole('button', { name: 'Silence' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(network.sent.map((request) => request.route)).toContain(`DELETE ${SILENCE}`)
  })

  it('render_ShouldKeepTheSilenceEndOnOneLineInTheTile_WhenItIsMinutePrecise', async () => {
    // Arrange
    home({
      [`GET ${SILENCE}`]: ok({
        active: true,
        until: inTwoHours('23:08'),
        scheduleNextChange: null,
      }),
    })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByText(/^En silence jusqu’à/)).toHaveProperty(
      'textContent',
      'En silence jusqu’à 23 h 08',
    )
  })

  it('onStartSilence_ShouldLeaveTheSilenceOffAndSayWhy_WhenVyzioRefuses', async () => {
    // Arrange
    home({ [`PUT ${SILENCE}`]: failure(400, 'silence_too_long', 'At most 7 days.') })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Silence' }))

    // Act
    await userEvent.click(await screen.findByRole('button', { name: '1 heure' }))

    // Assert
    expect(await screen.findByText(/silence_too_long/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Silence' })).toBeEnabled()
  })

  it('render_ShouldCountTheLastHourAndSayNotificationsAreToSetUp_WhenNoChannelIsConfigured', async () => {
    // Arrange
    home({
      'GET /api/hub/overview': ok({
        ...overview,
        notifications: { ...overview.notifications, activeChannels: 0 },
      }),
      'GET /api/detection-events/history': ok({
        items: [makeDetectionEvent(), makeDetectionEvent({ eventId: 'event-2' })],
        nextCursor: null,
      }),
    })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByText('2 depuis 1 h')).toBeInTheDocument()
    expect(await screen.findByText('À configurer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Détections/ })).toHaveAttribute('href', '/detections')
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveAttribute(
      'href',
      '/settings/notifications',
    )
  })

  it('render_ShouldLeaveTheTilesWithoutSubtitle_WhenNothingIsToKnow', async () => {
    // Arrange
    home()

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByRole('link', { name: 'Détections' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('render_ShouldOfferOnlyToAddACameraAndStayHome_WhenNoCameraIsAddedYet', async () => {
    // Arrange
    home({ 'GET /api/cameras': ok([]) })

    // Act
    const { router } = renderScreen(<HubView />, { path: '/', url: '/' })

    // Assert
    expect(await screen.findByRole('link', { name: 'Ajouter une caméra' })).toHaveAttribute(
      'href',
      '/settings/cameras/add',
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByText('Bienvenue')).not.toBeInTheDocument()
  })

  it('onReloadCameras_ShouldShowTheCameras_WhenTheRetryReadsTheList', async () => {
    // Arrange
    const network = home({ 'GET /api/cameras': failure(503) })
    renderScreen(<HubView />)
    expect(
      await screen.findByText('La liste de vos caméras n’a pas pu être lue.'),
    ).toBeInTheDocument()
    network.answer('GET /api/cameras', ok([makeCamera()]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('link', { name: 'Front Door' })).toBeInTheDocument()
  })

  it('render_ShouldStillShowTheCameras_WhenTheSilenceCannotBeRead', async () => {
    // Arrange
    home({ [`GET ${SILENCE}`]: failure(500) })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByRole('link', { name: 'Front Door' })).toBeInTheDocument()
    expect(screen.getByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Silence' })).toBeEnabled()
  })
})
