import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import { makeCameraProtocol as protocolRow } from '../../testing/camera_protocol_fixture'
import { makeCameraStream, makeStreamLineup } from '../../testing/camera_stream_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { CameraConnectionView } from './camera_connection.component'
import { NO_PROTOCOL_FOR_ANOTHER_CAPABILITY, NO_PROTOCOL_YET } from './protocol_labels'
import { RECORDING_STREAM_KEPT } from './stream_lines'

const BINDINGS = 'GET /api/cameras/camera-1/capabilities'
const UPDATE = 'PUT /api/cameras/camera-1'
const VERIFY = 'POST /api/cameras/camera-1/verify'
const DELETE = 'DELETE /api/cameras/camera-1'
const DETECT = 'POST /api/cameras/camera-1/capabilities/detect'
const PROBE_PTZ = 'POST /api/cameras/camera-1/capabilities/ptz/probe'
const CAMERAS = 'GET /api/cameras'
const STATS = 'GET /api/system/stats'
const PROTOCOLS = 'GET /api/cameras/camera-1/protocols'
const STREAM_PATH = 'PUT /api/cameras/camera-1/capabilities/stream/path'
const SEARCH = 'POST /api/cameras/camera-1/protocols/search'
const STREAMS = 'GET /api/cameras/camera-1/streams'

const rtsp = protocolRow()
const onvif = protocolRow({ protocol: 'onvif', effectivePort: 2020 })
const dvrip = protocolRow({ protocol: 'dvrip', effectivePort: 34567 })
const klap = protocolRow({ protocol: 'tapo_klap', effectivePort: 80 })
const v380 = protocolRow({ protocol: 'v380', effectivePort: 8800 })

const mainStream = makeCameraStream()
const recording = makeCameraStream({ role: 'record' })
const detecting = makeCameraStream({
  id: 'sub',
  ordinal: 1,
  path: '/stream2',
  width: 640,
  height: 360,
  fps: 10,
  role: 'detect',
})
const twoStreams = makeStreamLineup([recording, detecting], { detectStreamId: 'sub' })

async function streamLine(quality: string) {
  return within(await screen.findByRole('listitem', { name: quality }))
}

/** The screen's network, its protocols answering with the camera's RTSP row and its one main stream unless a test says otherwise. */
function connectionNetwork(routes: Parameters<typeof fakeNetwork>[0]) {
  return fakeNetwork({
    [PROTOCOLS]: ok([rtsp]),
    [STREAMS]: ok(makeStreamLineup([mainStream])),
    ...routes,
  })
}

const camera = makeCamera()
const cameraThatTurns = makeCamera({ ptzSupported: true })
const rtspStream = makeCapabilityBinding({
  capability: 'stream',
  protocol: 'rtsp',
  streamPath: '/stream1',
})
const dvripStream = makeCapabilityBinding({ capability: 'stream', protocol: 'dvrip' })
const ptzCapability = makeCapabilityBinding({ capability: 'ptz', protocol: 'onvif' })
const streamToConfigure = makeCapabilityBinding({
  capability: 'stream',
  protocol: 'rtsp',
  verified: false,
  isConfigured: false,
})
const cameraWithoutStream = makeCamera({ status: 'offline', connected: false })
const privacyToConfigure = makeCapabilityBinding({
  capability: 'hardware_privacy',
  protocol: 'tapo_klap',
  verified: false,
  isConfigured: false,
})

function connectionTab(shown = camera) {
  return {
    path: '/settings/cameras/:cameraId/connexion',
    url: '/settings/cameras/camera-1/connexion',
    outletContext: shown,
  }
}

async function capabilityCards() {
  return within(await screen.findByRole('list', { name: 'Capacités' })).getAllByRole('listitem')
}

async function protocolRows() {
  return within(await screen.findByRole('list', { name: 'Protocoles' })).getAllByRole('listitem')
}

async function cardOf(title: string) {
  const heading = await screen.findByRole('heading', { name: title })
  return within(heading.closest('li') as HTMLElement)
}

/** Opens a card's Options fold, where its protocol and settings are. */
async function optionsOf(title: string) {
  const card = await cardOf(title)
  await userEvent.click(card.getByText('Options'))
  return card
}

async function protocolBox(name: string) {
  return within(await screen.findByRole('listitem', { name }))
}

async function renameTheCamera() {
  const name = await screen.findByLabelText('Nom')
  await userEvent.clear(name)
  await userEvent.type(name, 'Entrée')
}

describe('CameraConnectionView', () => {
  it('onSave_ShouldSaveTheNewNameAndKeepThePassword_WhenTheUserRenamesTheCamera', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([]),
      [UPDATE]: ok(camera),
      [CAMERAS]: ok([]),
      [STATS]: ok(null),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await renameTheCamera()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Connexion enregistrée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: UPDATE,
        body: expect.objectContaining({ displayName: 'Entrée', password: null }),
      }),
    )
  })

  it('onSave_ShouldKeepTheDraftAndSayWhy_WhenTheSaveFails', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([]), [UPDATE]: failure(500) })
    renderScreen(<CameraConnectionView />, connectionTab())
    await renameTheCamera()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/PUT \/api\/cameras\/camera-1 · 500/)).toBeVisible()
    expect(screen.getByLabelText('Nom')).toHaveValue('Entrée')
  })

  it('onVerify_ShouldSayTheCameraIsUnreachableAndWhy_WhenItsStreamDoesNotAnswer', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([]),
      [VERIFY]: ok({ connected: false, guidance: 'Aucun service joignable sur le port 554.' }),
      [CAMERAS]: ok([]),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    const stream = await cardOf('Flux vidéo')

    // Act
    await userEvent.click(stream.getByRole('button', { name: 'Vérifier' }))

    // Assert
    expect(
      await screen.findByText(
        'Caméra injoignable : vérifiez l’adresse et le compte de la caméra dans Avancé, puis les options du flux vidéo.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Aucun service joignable sur le port 554.')).toBeVisible()
  })

  it('onVerify_ShouldSayTheStreamWorks_WhenTheCameraAnswers', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([]), [VERIFY]: ok({ connected: true }), [CAMERAS]: ok([]) })
    renderScreen(<CameraConnectionView />, connectionTab())
    const stream = await cardOf('Flux vidéo')

    // Act
    await userEvent.click(stream.getByRole('button', { name: 'Vérifier' }))

    // Assert
    expect(await screen.findByText('Flux vidéo : connexion réussie.')).toBeInTheDocument()
  })

  it('onDelete_ShouldDeleteAndGoBackToTheList_WhenTheUserConfirms', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([]),
      [DELETE]: ok({ deleted: true, message: 'Caméra supprimée.', configPath: '' }),
      [CAMERAS]: ok([]),
    })
    const { router } = renderScreen(<CameraConnectionView />, connectionTab())
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer cette caméra' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
    )

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/cameras'))
    expect(network.sent).toContainEqual(expect.objectContaining({ route: DELETE }))
  })

  it('onLoad_ShouldShowTheStreamFirstWithTheCameraStatusAndNoProtocol_WhenTheCameraHasCapabilities', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([ptzCapability]) })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))

    // Assert
    const [stream, orientation] = await capabilityCards()
    expect(stream).toHaveTextContent('Flux vidéoConnectée')
    expect(orientation).toHaveTextContent('OrientationFonctionne')
    expect(stream).not.toHaveTextContent('RTSP')
    expect(orientation).not.toHaveTextContent('ONVIF')
  })

  it('onLoad_ShouldListEachProtocolOnceWithItsPortAndState_WhenTheCameraSpeaksSeveral', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([rtspStream, ptzCapability]),
      [PROTOCOLS]: ok([
        rtsp,
        protocolRow({ protocol: 'onvif', effectivePort: 2020, status: null }),
      ]),
    })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    const [rtspBox, onvifBox] = await protocolRows()
    expect(rtspBox).toHaveTextContent('RTSPRépond')
    expect(within(rtspBox).getByLabelText('Port')).toHaveValue(554)
    expect(onvifBox).toHaveTextContent('ONVIFPas encore vérifié')
    expect(within(onvifBox).getByLabelText('Port')).toHaveValue(2020)
    expect(screen.queryByLabelText('Chemin du flux')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldShowTheStreamPathInTheStreamOptions_WhenTheStreamGoesOverRtsp', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([rtspStream]) })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    const stream = await optionsOf('Flux vidéo')

    // Assert
    expect(stream.getByLabelText('Chemin du flux')).toHaveValue('/stream1')
    expect(stream.getByRole('combobox', { name: 'Protocole' })).toHaveTextContent('RTSP')
  })

  it('onLoad_ShouldShowTheStreamOverDvripWithoutAStreamPath_WhenTheCameraStreamsOverDvrip', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([dvripStream]),
      [PROTOCOLS]: ok([protocolRow({ protocol: 'dvrip', effectivePort: 34567 })]),
      [STREAMS]: ok(makeStreamLineup([makeCameraStream({ protocol: 'dvrip', path: null })])),
    })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    const stream = await optionsOf('Flux vidéo')

    // Assert
    expect(stream.getByRole('combobox', { name: 'Protocole' })).toHaveTextContent('DVRIP')
    expect(stream.queryByLabelText('Chemin du flux')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldAskToChooseHowTheStreamIsRead_WhenTheStreamHasNoProtocolYet', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([{ ...rtspStream, isConfigured: false, streamPath: null }]),
      [PROTOCOLS]: ok([]),
    })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    const stream = await cardOf('Flux vidéo')
    expect(await stream.findByText('À configurer')).toBeInTheDocument()
    expect(stream.getByRole('button', { name: 'Vérifier' })).toBeDisabled()
  })

  it('onLoad_ShouldKeepTheLastStreamFailureForSupport_WhenTheCameraIsOffline', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([
        {
          ...rtspStream,
          verified: false,
          lastError: 'RTSP: 192.168.1.10:554 refused the connection.',
        },
      ]),
    })

    // Act
    renderScreen(
      <CameraConnectionView />,
      connectionTab(makeCamera({ status: 'offline', connected: false })),
    )

    // Assert
    expect(await screen.findByText('RTSP: 192.168.1.10:554 refused the connection.')).toBeVisible()
  })

  it('onLoad_ShouldSayTheCameraDoesNotAnswerThatWay_WhenTheCapabilityProtocolIsUnreachable', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([rtspStream, { ...ptzCapability, verified: false }]),
      [PROTOCOLS]: ok([
        rtsp,
        protocolRow({ protocol: 'onvif', effectivePort: null, status: 'unreachable' }),
      ]),
    })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))

    // Assert
    const orientation = await cardOf('Orientation')
    expect(
      await orientation.findByText(
        'La caméra ne répond pas par ce moyen : vérifiez qu’elle est allumée, ou réveillez-la si elle est sur batterie, puis relancez.',
      ),
    ).toBeInTheDocument()
  })

  it('onLoad_ShouldSendTheStreamToWakingTheCamera_WhenItsProtocolDoesNotAnswer', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([dvripStream]),
      [PROTOCOLS]: ok([
        protocolRow({ protocol: 'dvrip', effectivePort: 34567, status: 'unreachable' }),
      ]),
    })

    // Act
    renderScreen(
      <CameraConnectionView />,
      connectionTab(makeCamera({ status: 'offline', connected: false })),
    )

    // Assert
    const stream = await cardOf('Flux vidéo')
    expect(
      await stream.findByText(
        'La caméra ne répond pas par ce moyen : vérifiez qu’elle est allumée, ou réveillez-la si elle est sur batterie, puis relancez.',
      ),
    ).toBeInTheDocument()
  })

  it('onLoad_ShouldSayTheProtocolsCouldNotBeRead_WhenTheirReadFails', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([rtspStream]), [PROTOCOLS]: failure(500) })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    expect(
      await screen.findByText('Les protocoles de cette caméra n’ont pas pu être lus.'),
    ).toBeInTheDocument()
  })

  it('onCheckProtocol_ShouldShowWhatTheCameraSaid_WhenTheUserChecksAProtocol', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      'POST /api/cameras/camera-1/protocols/rtsp/check': ok(
        protocolRow({
          status: 'refused',
          lastError: 'RTSP: refused the account (401 Unauthorized).',
        }),
      ),
    })
    renderScreen(
      <CameraConnectionView />,
      connectionTab(makeCamera({ status: 'offline', connected: false })),
    )
    await userEvent.click(await screen.findByText('Avancé'))
    const box = await protocolBox('RTSP')

    // Act
    await userEvent.click(box.getByRole('button', { name: 'Vérifier' }))

    // Assert
    expect(await box.findByText('Refuse l’accès')).toBeInTheDocument()
    expect(
      box.getByText(
        'La caméra refuse le compte : vérifiez celui de la caméra, ou le compte spécifique de ce protocole.',
      ),
    ).toBeVisible()
    expect(box.getByText('RTSP: refused the account (401 Unauthorized).')).toBeVisible()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: 'POST /api/cameras/camera-1/protocols/rtsp/check' }),
    )
  })

  it('onSave_ShouldSaveTheProtocolPortAndItsSpecificAccount_WhenTheUserChangesThem', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      'PUT /api/cameras/camera-1/protocols/rtsp': ok(
        protocolRow({ port: 8554, effectivePort: 8554 }),
      ),
      [CAMERAS]: ok([]),
      [STATS]: ok(null),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    const box = await protocolBox('RTSP')
    await userEvent.clear(box.getByLabelText('Port'))
    await userEvent.type(box.getByLabelText('Port'), '8554')
    await userEvent.tab()
    await userEvent.click(box.getByRole('switch', { name: 'Compte spécifique' }))
    await userEvent.type(box.getByLabelText('Identifiant'), 'viewer')
    await userEvent.type(box.getByLabelText('Mot de passe'), 'test-secret')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Connexion enregistrée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual({
      route: 'PUT /api/cameras/camera-1/protocols/rtsp',
      query: '',
      body: { port: 8554, username: 'viewer', password: 'test-secret', deviceId: null },
    })
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: UPDATE }))
  })

  it('onSave_ShouldSaveTheStreamPathOnItsCapability_WhenTheUserChangesIt', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [STREAM_PATH]: ok({ ...rtspStream, streamPath: '/stream2' }),
      [CAMERAS]: ok([]),
      [STATS]: ok(null),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    const stream = await optionsOf('Flux vidéo')
    await userEvent.clear(stream.getByLabelText('Chemin du flux'))
    await userEvent.type(stream.getByLabelText('Chemin du flux'), '/stream2')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Connexion enregistrée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: STREAM_PATH, body: { path: '/stream2' } }),
    )
  })

  it('onLoad_ShouldSayTheStreamFailsAndSuspendTheOtherChecks_WhenTheCameraIsOffline', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([ptzCapability]) })

    // Act
    renderScreen(
      <CameraConnectionView />,
      connectionTab(makeCamera({ status: 'offline', connected: false, ptzSupported: true })),
    )

    // Assert
    const orientation = await cardOf('Orientation')
    const [stream] = await capabilityCards()
    expect(stream).toHaveTextContent('Hors ligne')
    expect(stream).toHaveTextContent(
      'Vyzio ne reçoit pas les images : vérifiez l’adresse et le compte de la caméra dans Avancé, puis les options du flux vidéo.',
    )
    expect(orientation.getByRole('button', { name: 'Vérifier' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Détecter automatiquement' })).toBeDisabled()
  })

  it('onVerifyCapability_ShouldTestTheSavedProtocolAgain_WhenTheUserChecksACapability', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([ptzCapability]),
      [PROBE_PTZ]: ok(ptzCapability),
    })
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))
    const orientation = await cardOf('Orientation')

    // Act
    await userEvent.click(orientation.getByRole('button', { name: 'Vérifier' }))

    // Assert
    expect(await screen.findByText('Orientation : connexion réussie.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(expect.objectContaining({ route: PROBE_PTZ }))
  })

  it('onVerifyCapability_ShouldShowTheCameraAnswerForSupport_WhenTheTestFails', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([ptzCapability]),
      [PROBE_PTZ]: ok({ ...ptzCapability, verified: false, lastError: 'fault: not authorized' }),
    })
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))
    const orientation = await cardOf('Orientation')

    // Act
    await userEvent.click(orientation.getByRole('button', { name: 'Vérifier' }))

    // Assert
    expect(
      await screen.findByText('Connexion échouée : vérifiez l’accès réseau et les identifiants.'),
    ).toBeInTheDocument()
    expect(screen.getByText('fault: not authorized')).toBeVisible()
  })

  it('onLoad_ShouldSayTheCapabilitiesCouldNotBeReadRatherThanOfferThemAll_WhenTheReadFails', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: failure(500) })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    expect(
      await screen.findByText('Les capacités de cette caméra n’ont pas pu être lues.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/cameras\/camera-1\/capabilities · 500/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Flux vidéo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter une capacité' })).not.toBeInTheDocument()
  })

  it('onRetryRead_ShouldListTheCapabilities_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = connectionNetwork({ [BINDINGS]: failure(500) })
    renderScreen(<CameraConnectionView />, connectionTab())
    const retry = await screen.findByRole('button', { name: 'Réessayer' })
    network.answer(BINDINGS, ok([ptzCapability]))

    // Act
    await userEvent.click(retry)

    // Assert
    expect(await screen.findByRole('heading', { name: 'Orientation' })).toBeInTheDocument()
  })

  it('onLoad_ShouldSayTheCameraIsGoneWithTheWayBack_WhenItsCapabilitiesAreNotFound', async () => {
    // Arrange
    const network = connectionNetwork({ [BINDINGS]: failure(404), [CAMERAS]: ok([]) })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    expect(
      await screen.findByText('Cette caméra est introuvable : elle a peut-être été supprimée.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revenir à la liste des caméras' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
    expect(network.sent).toContainEqual(expect.objectContaining({ route: CAMERAS }))
  })

  it('onDetect_ShouldKeepTheShownCapabilitiesAndSayWhy_WhenTheRereadFails', async () => {
    // Arrange
    const network = connectionNetwork({ [BINDINGS]: ok([ptzCapability]), [DETECT]: ok() })
    renderScreen(<CameraConnectionView />, connectionTab())
    await screen.findByRole('heading', { name: 'Orientation' })
    network.answer(BINDINGS, failure(500))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Détecter automatiquement' }))

    // Assert
    expect(
      await screen.findByText(/GET \/api\/cameras\/camera-1\/capabilities · 500/),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Orientation' })).toBeInTheDocument()
    expect(
      screen.queryByText('Les capacités de cette caméra n’ont pas pu être lues.'),
    ).not.toBeInTheDocument()
  })

  it('onDetect_ShouldSayTheDetectionIsDone_WhenItFinishes', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([]), [DETECT]: ok() })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Détecter automatiquement' }))

    // Assert
    expect(await screen.findByText('Détection terminée.')).toBeInTheDocument()
  })

  it('onConfigure_ShouldSayTheConnectionWorks_WhenTheCameraAnswers', async () => {
    // Arrange
    const network = connectionNetwork({
      [PROTOCOLS]: ok([rtsp, klap]),
      [BINDINGS]: ok([privacyToConfigure]),
      'PUT /api/cameras/camera-1/capabilities/hardware_privacy': ok({
        ...privacyToConfigure,
        verified: true,
        isConfigured: true,
      }),
    })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Configurer' }))

    // Assert
    expect(await screen.findByText('Coupure matérielle : connexion réussie.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PUT /api/cameras/camera-1/capabilities/hardware_privacy',
        body: { protocol: 'tapo_klap' },
      }),
    )
  })

  it('onConfigure_ShouldShowTheCameraAnswerForSupport_WhenTheTestFails', async () => {
    // Arrange
    connectionNetwork({
      [PROTOCOLS]: ok([rtsp, klap]),
      [BINDINGS]: ok([privacyToConfigure]),
      'PUT /api/cameras/camera-1/capabilities/hardware_privacy': ok({
        ...privacyToConfigure,
        lastError: 'KLAP handshake refused',
      }),
    })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Configurer' }))

    // Assert
    expect(
      await screen.findByText('Connexion échouée : vérifiez l’accès réseau et les identifiants.'),
    ).toBeInTheDocument()
    expect(screen.getByText('KLAP handshake refused')).toBeVisible()
  })

  it('onConfigure_ShouldTestTheNewProtocol_WhenTheUserChangesItInTheCardOptions', async () => {
    // Arrange
    const network = connectionNetwork({
      [PROTOCOLS]: ok([rtsp, onvif, dvrip]),
      [BINDINGS]: ok([ptzCapability]),
      'PUT /api/cameras/camera-1/capabilities/ptz': ok(ptzCapability),
    })
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))
    const orientation = await optionsOf('Orientation')
    // The list opens on the current protocol (ONVIF); the next one down is DVRIP.
    orientation.getByRole('combobox', { name: 'Protocole' }).focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    // Act
    await userEvent.click(orientation.getByRole('button', { name: 'Configurer' }))

    // Assert
    expect(await screen.findByText('Orientation : connexion réussie.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PUT /api/cameras/camera-1/capabilities/ptz',
        body: { protocol: 'dvrip' },
      }),
    )
  })

  it('onConfigure_ShouldBeSuspendedWithTheReasonNearby_WhenTheStreamFails', async () => {
    // Arrange
    connectionNetwork({ [PROTOCOLS]: ok([rtsp, klap]), [BINDINGS]: ok([privacyToConfigure]) })
    renderScreen(
      <CameraConnectionView />,
      connectionTab(makeCamera({ status: 'offline', connected: false })),
    )
    const privacy = await cardOf('Coupure matérielle')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une capacité' }))

    // Assert
    expect(privacy.getByRole('button', { name: 'Configurer' })).toBeDisabled()
    expect(
      within(screen.getByText('Configurer manuellement').parentElement as HTMLElement).getByRole(
        'button',
        { name: 'Configurer' },
      ),
    ).toBeDisabled()
    expect(
      screen.getByText('Les autres capacités se vérifient une fois le flux vidéo rétabli.'),
    ).toBeVisible()
  })

  it('onTogglePtz_ShouldTurnOrientationOnAndReadTheCamerasAgain_WhenTheUserActivatesIt', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([ptzCapability]),
      [UPDATE]: ok(camera),
      [CAMERAS]: ok([]),
    })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Activer' }))

    // Assert
    expect(await screen.findByText('Orientation activée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: UPDATE,
        body: expect.objectContaining({ ptzSupported: true, password: null }),
      }),
    )
    expect(network.sent).toContainEqual(expect.objectContaining({ route: CAMERAS }))
  })

  it('onTogglePtz_ShouldTurnOrientationOff_WhenTheUserConfirms', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([ptzCapability]),
      [UPDATE]: ok(camera),
      [CAMERAS]: ok([]),
    })
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))
    await userEvent.click(await screen.findByRole('button', { name: 'Désactiver' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Désactiver' }),
    )

    // Assert
    expect(await screen.findByText('Orientation désactivée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: UPDATE,
        body: expect.objectContaining({ ptzSupported: false }),
      }),
    )
  })

  it('onRemove_ShouldRemoveTheCapability_WhenTheUserConfirms', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([makeCapabilityBinding()]),
      'DELETE /api/cameras/camera-1/capabilities/image_settings': ok(),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    const image = await cardOf('Réglages image')
    await userEvent.click(image.getByRole('button', { name: 'Retirer' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retirer' }),
    )

    // Assert
    expect(await screen.findByText('Réglages image : capacité retirée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'DELETE /api/cameras/camera-1/capabilities/image_settings',
      }),
    )
  })

  it('onLoad_ShouldOfferToAddACapabilityRightAfterTheCardsOutsideAnyFold_WhenOneIsLeftToAdd', async () => {
    // Arrange
    connectionNetwork({
      [PROTOCOLS]: ok([rtsp, onvif]),
      [BINDINGS]: ok([rtspStream, ptzCapability]),
    })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))

    // Assert
    const add = await screen.findByRole('button', { name: 'Ajouter une capacité' })
    const lastCard = screen.getByRole('heading', { name: 'Orientation' }).closest('li') as Node
    expect(add.closest('details')).toBeNull()
    expect(lastCard.compareDocumentPosition(add)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('onLoad_ShouldPointAtTheCardsOptions_WhenEveryCapabilityAlreadyHasItsCard', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([
        rtspStream,
        { ...ptzCapability, verified: false },
        makeCapabilityBinding({ capability: 'hardware_privacy', protocol: 'tapo_klap' }),
        makeCapabilityBinding({ capability: 'image_settings', protocol: 'onvif' }),
      ]),
    })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))

    // Assert
    expect(
      await screen.findByText(
        'Chaque capacité a déjà sa carte : pour en joindre une autrement, ouvrez ses options.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter une capacité' })).not.toBeInTheDocument()
  })

  it('onAddProtocol_ShouldAddTheProtocolAndCheckItAtOnce_WhenTheUserFillsTheForm', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      'POST /api/cameras/camera-1/protocols': ok(
        protocolRow({ protocol: 'onvif', port: 2020, effectivePort: 2020 }),
      ),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await userEvent.click(await screen.findByText('Avancé'))
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un protocole' }))
    const form = within(screen.getByRole('group', { name: 'Ajouter un protocole' }))
    await userEvent.type(form.getByRole('spinbutton', { name: 'Port' }), '2020')

    // Act
    await userEvent.click(form.getByRole('button', { name: 'Ajouter et vérifier' }))

    // Assert
    expect(await screen.findByText('Protocole ajouté.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'POST /api/cameras/camera-1/protocols',
        body: { protocol: 'onvif', port: 2020, username: null, password: null },
      }),
    )
  })

  it('onOpenProtocolForm_ShouldSayTheSpecificAccountStaysOnTheNetwork_WhenTheUserSwitchesItOn', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([rtspStream]) })
    renderScreen(<CameraConnectionView />, connectionTab())
    await userEvent.click(await screen.findByText('Avancé'))
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un protocole' }))
    const form = within(screen.getByRole('group', { name: 'Ajouter un protocole' }))

    // Act
    await userEvent.click(form.getByRole('switch', { name: 'Compte spécifique' }))

    // Assert
    expect(form.getByText(/Il n’est présenté qu’à la caméra, sur votre réseau\./)).toBeVisible()
    expect(form.getByRole('textbox', { name: 'Identifiant' })).toBeVisible()
  })

  it('onCheckProtocol_ShouldKeepNoPendingChangeAndAllowRemoval_WhenABoxWasEditedThenPutBack', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [PROTOCOLS]: ok([rtsp, protocolRow({ protocol: 'onvif', effectivePort: 2020 })]),
      'POST /api/cameras/camera-1/protocols/onvif/check': ok(
        protocolRow({ protocol: 'onvif', effectivePort: 2020 }),
      ),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await userEvent.click(await screen.findByText('Avancé'))
    const box = await protocolBox('ONVIF')
    const port = box.getByRole('spinbutton', { name: 'Port' })
    await userEvent.clear(port)
    await userEvent.type(port, '2021')
    await userEvent.tab()
    await userEvent.clear(port)
    await userEvent.type(port, '2020')
    await userEvent.tab()

    // Act
    await userEvent.click(box.getByRole('button', { name: 'Vérifier' }))

    // Assert
    await waitFor(() => expect(box.getByRole('button', { name: 'Vérifier' })).toBeEnabled())
    expect(screen.queryByRole('region', { name: 'Modifications en attente' })).toBeNull()
    expect(box.getByRole('button', { name: 'Retirer' })).toBeEnabled()
  })

  it('onLoad_ShouldRefuseToRemoveAProtocolWithThePlainReason_WhenACapabilityGoesThroughIt', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([rtspStream]) })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await userEvent.click(await screen.findByText('Avancé'))

    // Assert
    const box = await protocolBox('RTSP')
    expect(box.getByRole('button', { name: 'Retirer' })).toBeDisabled()
    expect(
      box.getByText(
        'Flux vidéo passe par ce protocole : changez d’abord le sien dans ses options.',
      ),
    ).toBeInTheDocument()
  })

  it('onRemoveProtocol_ShouldRemoveTheProtocol_WhenNoCapabilityUsesItAndTheUserConfirms', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [PROTOCOLS]: ok([rtsp, protocolRow({ protocol: 'onvif', effectivePort: 2020 })]),
      'DELETE /api/cameras/camera-1/protocols/onvif': ok(),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await userEvent.click(await screen.findByText('Avancé'))
    const box = await protocolBox('ONVIF')
    await userEvent.click(box.getByRole('button', { name: 'Retirer' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retirer' }),
    )

    // Assert
    expect(await screen.findByText('Protocole retiré.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: 'DELETE /api/cameras/camera-1/protocols/onvif' }),
    )
  })

  it('onConfigureManually_ShouldTestTheFirstCapabilityLeft_WhenTheUserKeepsTheDefaults', async () => {
    // Arrange
    const network = connectionNetwork({
      [PROTOCOLS]: ok([rtsp, v380]),
      [BINDINGS]: ok([]),
      'PUT /api/cameras/camera-1/capabilities/ptz': ok(ptzCapability),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une capacité' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Configurer' }))

    // Assert
    expect(await screen.findByRole('button', { name: 'Ajouter une capacité' })).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PUT /api/cameras/camera-1/capabilities/ptz',
        body: { protocol: 'v380' },
      }),
    )
  })

  it('onLoad_ShouldOfferNoPickerAndPointAtDetection_WhenTheCameraHasNoProtocol', async () => {
    // Arrange
    connectionNetwork({
      [PROTOCOLS]: ok([]),
      [BINDINGS]: ok([streamToConfigure, privacyToConfigure]),
    })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab(cameraWithoutStream))

    // Assert
    expect(await screen.findAllByText(NO_PROTOCOL_YET)).toHaveLength(2)
    expect(screen.queryByText('Options')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Configurer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ajouter une capacité' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Détecter automatiquement' })).toBeEnabled()
    expect(
      screen.queryByText('Les autres capacités se vérifient une fois le flux vidéo rétabli.'),
    ).toBeNull()
  })

  it('onLoad_ShouldNeverSayTheCameraHasNoProtocol_WhenItsProtocolsCouldNotBeRead', async () => {
    // Arrange
    connectionNetwork({
      [PROTOCOLS]: failure(500),
      [BINDINGS]: ok([rtspStream, privacyToConfigure]),
    })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    expect(await screen.findByRole('heading', { name: 'Coupure matérielle' })).toBeVisible()
    expect(screen.queryByText(NO_PROTOCOL_YET)).toBeNull()
    expect(screen.queryByText(NO_PROTOCOL_FOR_ANOTHER_CAPABILITY)).toBeNull()
  })

  it('onLoad_ShouldOfferOnlyTheCameraProtocols_WhenTheStreamOptionsOpen', async () => {
    // Arrange
    connectionNetwork({ [PROTOCOLS]: ok([dvrip]), [BINDINGS]: ok([streamToConfigure]) })
    renderScreen(<CameraConnectionView />, connectionTab(cameraWithoutStream))
    const stream = await optionsOf('Flux vidéo')

    // Act
    stream.getByRole('combobox', { name: 'Protocole' }).focus()
    await userEvent.keyboard('{ArrowDown}')

    // Assert
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['DVRIP'])
  })

  it('onConfigure_ShouldSayTheCameraLacksTheProtocol_WhenTheServerRefusesIt', async () => {
    // Arrange
    const network = connectionNetwork({
      [PROTOCOLS]: ok([rtsp, klap]),
      [BINDINGS]: ok([privacyToConfigure]),
      'PUT /api/cameras/camera-1/capabilities/hardware_privacy': failure(
        409,
        'protocol_not_on_camera',
        'The camera has no TapoKlap protocol: add it first.',
      ),
    })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Configurer' }))

    // Assert
    expect(
      await screen.findByText(
        'Cette caméra n’a pas ce protocole : lancez « Détecter automatiquement », ou ajoutez-le dans Avancé',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(network.sent.filter((request) => request.route === PROTOCOLS)).toHaveLength(2),
    )
  })

  it('onLoad_ShouldPointAtDetectionInsteadOfAddingACapability_WhenNoProtocolOfTheCameraCarriesOne', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([rtspStream]) })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    expect(await screen.findByText(NO_PROTOCOL_FOR_ANOTHER_CAPABILITY)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ajouter une capacité' })).toBeNull()
  })

  it('onSearchProtocols_ShouldShowTheProtocolsFound_WhenTheSearchFinishes', async () => {
    // Arrange
    const network = connectionNetwork({
      [PROTOCOLS]: ok([]),
      [BINDINGS]: ok([streamToConfigure]),
      [SEARCH]: ok([dvrip]),
    })
    renderScreen(<CameraConnectionView />, connectionTab(cameraWithoutStream))
    await userEvent.click(await screen.findByText('Avancé'))

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Rechercher les protocoles' }))

    // Assert
    expect(await screen.findByText('Recherche terminée.')).toBeInTheDocument()
    expect(await protocolBox('DVRIP')).toBeTruthy()
    expect(network.sent.map((request) => request.route)).not.toContain(DETECT)
  })

  it('onLoad_ShouldListEachStreamWithItsQualityRoleAndState_WhenTheCameraServesTwo', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [STREAMS]: ok(twoStreams),
    })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await optionsOf('Flux vidéo')

    // Assert
    const sub = await streamLine('640 × 360 · 10 img/s')
    expect(sub.getByRole('combobox', { name: 'Rôle' })).toHaveTextContent('Détection')
    expect(sub.getByText('Fonctionne')).toBeInTheDocument()
    expect(sub.getByText('RTSP · /stream2')).toBeInTheDocument()
  })

  it('onLoad_ShouldLockDisableAndRemove_WhenTheStreamRecords', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([rtspStream]), [STREAMS]: ok(twoStreams) })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await optionsOf('Flux vidéo')

    // Assert
    const main = await streamLine('1920 × 1080 · 15 img/s')
    expect(main.getByRole('button', { name: 'Désactiver' })).toBeDisabled()
    expect(main.getByRole('button', { name: 'Supprimer' })).toBeDisabled()
    expect(main.getByText(RECORDING_STREAM_KEPT)).toBeInTheDocument()
  })

  it('onSetStreamRole_ShouldSendTheRole_WhenTheUserGivesDetectionToTheRecordingStream', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [STREAMS]: ok(twoStreams),
      'PUT /api/cameras/camera-1/streams/main/role': ok(twoStreams),
      [STATS]: ok(null),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await optionsOf('Flux vidéo')
    const main = await streamLine('1920 × 1080 · 15 img/s')

    // Act
    main.getByRole('combobox', { name: 'Rôle' }).focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    // Assert
    expect(await screen.findByText('Rôle du flux changé.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PUT /api/cameras/camera-1/streams/main/role',
        body: { role: 'record_and_detect' },
      }),
    )
  })

  it('onSetStreamEnabled_ShouldSayDetectionRunsOnTheRecordingStream_WhenTheDetectStreamIsDisabled', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [STREAMS]: ok(twoStreams),
      'PUT /api/cameras/camera-1/streams/sub/enabled': ok(
        makeStreamLineup([recording, { ...detecting, enabled: false, role: 'none' }], {
          detectsOnRecordingStream: true,
        }),
      ),
      [STATS]: ok(null),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await optionsOf('Flux vidéo')
    const sub = await streamLine('640 × 360 · 10 img/s')

    // Act
    await userEvent.click(sub.getByRole('button', { name: 'Désactiver' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Désactiver' }),
    )

    // Assert
    expect(await screen.findByText('Flux désactivé.')).toBeInTheDocument()
    const card = await cardOf('Flux vidéo')
    expect(card.getByText('La détection passe par le flux d’enregistrement.')).toBeInTheDocument()
  })

  it('onLoad_ShouldSayDetectionStopped_WhenTheDetectStreamFailedItsCheck', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [STREAMS]: ok(
        makeStreamLineup([recording, { ...detecting, verified: false, lastError: 'timeout' }], {
          detectStreamId: 'sub',
        }),
      ),
    })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    const card = await cardOf('Flux vidéo')
    expect(
      await card.findByText(/Le flux de détection ne répond pas : la détection est interrompue\./),
    ).toBeInTheDocument()
  })

  it('onAddStream_ShouldDeclareTheStreamAndCheckIt_WhenTheUserFillsTheForm', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      'POST /api/cameras/camera-1/streams': ok(twoStreams),
      [STATS]: ok(null),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    const stream = await optionsOf('Flux vidéo')
    await userEvent.click(await stream.findByRole('button', { name: 'Ajouter un flux' }))
    const form = within(screen.getByRole('group', { name: 'Ajouter un flux' }))
    await userEvent.type(form.getByLabelText('Chemin du flux'), '/stream2')

    // Act
    await userEvent.click(form.getByRole('button', { name: 'Ajouter et vérifier' }))

    // Assert
    expect(await screen.findByText('Flux ajouté.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'POST /api/cameras/camera-1/streams',
        body: { protocol: 'rtsp', path: '/stream2', role: 'none', secondary: false },
      }),
    )
  })

  it('onAddStream_ShouldAskForTheSecondaryQuality_WhenTheStreamGoesOverDvrip', async () => {
    // Arrange
    const network = connectionNetwork({
      [BINDINGS]: ok([dvripStream]),
      [PROTOCOLS]: ok([dvrip]),
      [STREAMS]: ok(makeStreamLineup([makeCameraStream({ protocol: 'dvrip', path: null })])),
      'POST /api/cameras/camera-1/streams': ok(twoStreams),
      [STATS]: ok(null),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    const stream = await optionsOf('Flux vidéo')
    await userEvent.click(await stream.findByRole('button', { name: 'Ajouter un flux' }))
    const form = within(screen.getByRole('group', { name: 'Ajouter un flux' }))

    // Act
    await userEvent.click(form.getByRole('button', { name: 'Ajouter et vérifier' }))

    // Assert
    expect(await screen.findByText('Flux ajouté.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'POST /api/cameras/camera-1/streams',
        body: { protocol: 'dvrip', path: null, role: 'none', secondary: true },
      }),
    )
  })

  it('onRemoveStream_ShouldKeepTheLine_WhenTheRemovalFails', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [STREAMS]: ok(twoStreams),
      'DELETE /api/cameras/camera-1/streams/sub': failure(500),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await optionsOf('Flux vidéo')
    const sub = await streamLine('640 × 360 · 10 img/s')

    // Act
    await userEvent.click(sub.getByRole('button', { name: 'Supprimer' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
    )

    // Assert
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Flux supprimé.')).not.toBeInTheDocument()
    expect(await streamLine('640 × 360 · 10 img/s')).toBeTruthy()
  })

  it('onLoad_ShouldSayTheStreamsCouldNotBeRead_WhenTheirReadFails', async () => {
    // Arrange
    connectionNetwork({ [BINDINGS]: ok([rtspStream]), [STREAMS]: failure(500) })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await optionsOf('Flux vidéo')

    // Assert
    expect(
      await screen.findByText('Les flux de cette caméra n’ont pas pu être lus.'),
    ).toBeInTheDocument()
  })

  it('onCheckStream_ShouldSayTheStreamAnswers_WhenItsCheckPasses', async () => {
    // Arrange
    connectionNetwork({
      [BINDINGS]: ok([rtspStream]),
      [STREAMS]: ok(twoStreams),
      'POST /api/cameras/camera-1/streams/sub/check': ok(twoStreams),
      [CAMERAS]: ok([]),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await optionsOf('Flux vidéo')
    const sub = await streamLine('640 × 360 · 10 img/s')

    // Act
    await userEvent.click(sub.getByRole('button', { name: 'Vérifier' }))

    // Assert
    expect(await screen.findByText('Flux vérifié.')).toBeInTheDocument()
  })
})
