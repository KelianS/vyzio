import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { CameraConnectionView } from './camera_connection.component'

const BINDINGS = 'GET /api/cameras/camera-1/capabilities'
const UPDATE = 'PUT /api/cameras/camera-1'
const VERIFY = 'POST /api/cameras/camera-1/verify'
const DELETE = 'DELETE /api/cameras/camera-1'
const DETECT = 'POST /api/cameras/camera-1/capabilities/detect'
const PROBE_PTZ = 'POST /api/cameras/camera-1/capabilities/ptz/probe'
const CAMERAS = 'GET /api/cameras'
const STATS = 'GET /api/system/stats'

const camera = makeCamera()
const cameraThatTurns = makeCamera({ ptzSupported: true })
const ptzCapability = makeCapabilityBinding({ capability: 'ptz', protocol: 'onvif' })
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

async function renameTheCamera() {
  const name = await screen.findByLabelText('Nom')
  await userEvent.clear(name)
  await userEvent.type(name, 'Entrée')
}

describe('CameraConnectionView', () => {
  it('onSave_ShouldSaveTheNewNameAndKeepThePassword_WhenTheUserRenamesTheCamera', async () => {
    // Arrange
    const network = fakeNetwork({
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
    fakeNetwork({ [BINDINGS]: ok([]), [UPDATE]: failure(500) })
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
    fakeNetwork({
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
        'Caméra injoignable : vérifiez l’adresse et les identifiants de la caméra, dans Avancé.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Aucun service joignable sur le port 554.')).toBeVisible()
  })

  it('onVerify_ShouldSayTheStreamWorks_WhenTheCameraAnswers', async () => {
    // Arrange
    fakeNetwork({ [BINDINGS]: ok([]), [VERIFY]: ok({ connected: true }), [CAMERAS]: ok([]) })
    renderScreen(<CameraConnectionView />, connectionTab())
    const stream = await cardOf('Flux vidéo')

    // Act
    await userEvent.click(stream.getByRole('button', { name: 'Vérifier' }))

    // Assert
    expect(await screen.findByText('Flux vidéo : connexion réussie.')).toBeInTheDocument()
  })

  it('onDelete_ShouldDeleteAndGoBackToTheList_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({
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
    fakeNetwork({ [BINDINGS]: ok([ptzCapability]) })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab(cameraThatTurns))

    // Assert
    const [stream, orientation] = await capabilityCards()
    expect(stream).toHaveTextContent('Flux vidéoConnectée')
    expect(orientation).toHaveTextContent('OrientationFonctionne')
    expect(stream).not.toHaveTextContent('RTSP')
    expect(orientation).not.toHaveTextContent('ONVIF')
  })

  it('onLoad_ShouldListHowEachCapabilityIsReachedInTheAdvancedFold_WhenTheCameraHasCapabilities', async () => {
    // Arrange
    fakeNetwork({ [BINDINGS]: ok([ptzCapability]) })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    const [stream, orientation] = await protocolRows()
    expect(stream).toHaveTextContent('Flux vidéoRTSP')
    expect(orientation).toHaveTextContent('OrientationONVIF')
    expect(screen.getByLabelText('Chemin du flux')).toBeInTheDocument()
  })

  it('onLoad_ShouldShowTheStreamOverDvripWithoutAStreamPath_WhenTheCameraStreamsOverDvrip', async () => {
    // Arrange
    fakeNetwork({ [BINDINGS]: ok([]) })

    // Act
    renderScreen(
      <CameraConnectionView />,
      connectionTab(makeCamera({ streamProtocol: 'dvrip', port: 34567 })),
    )

    // Assert
    const [stream] = await protocolRows()
    expect(stream).toHaveTextContent('Flux vidéoDVRIP (ICSee / XMEye)')
    expect(screen.queryByLabelText('Chemin du flux')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldSayTheStreamFailsAndSuspendTheOtherChecks_WhenTheCameraIsOffline', async () => {
    // Arrange
    fakeNetwork({ [BINDINGS]: ok([ptzCapability]) })

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
      'Vyzio ne reçoit pas les images : vérifiez l’adresse et les identifiants de la caméra, dans Avancé.',
    )
    expect(orientation.getByRole('button', { name: 'Vérifier' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Détecter les capacités' })).toBeDisabled()
  })

  it('onVerifyCapability_ShouldTestTheSavedProtocolAgain_WhenTheUserChecksACapability', async () => {
    // Arrange
    const network = fakeNetwork({
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
    fakeNetwork({
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
    fakeNetwork({ [BINDINGS]: failure(500) })

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
    const network = fakeNetwork({ [BINDINGS]: failure(500) })
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
    const network = fakeNetwork({ [BINDINGS]: failure(404), [CAMERAS]: ok([]) })

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
    const network = fakeNetwork({ [BINDINGS]: ok([ptzCapability]), [DETECT]: ok() })
    renderScreen(<CameraConnectionView />, connectionTab())
    await screen.findByRole('heading', { name: 'Orientation' })
    network.answer(BINDINGS, failure(500))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Détecter les capacités' }))

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
    fakeNetwork({ [BINDINGS]: ok([]), [DETECT]: ok() })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Détecter les capacités' }))

    // Assert
    expect(await screen.findByText('Détection terminée.')).toBeInTheDocument()
  })

  it('onConfigure_ShouldSayTheConnectionWorks_WhenTheCameraAnswers', async () => {
    // Arrange
    const network = fakeNetwork({
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
        body: { protocol: 'tapo_klap', configJson: null },
      }),
    )
  })

  it('onConfigure_ShouldShowTheCameraAnswerForSupport_WhenTheTestFails', async () => {
    // Arrange
    fakeNetwork({
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

  it('onConfigure_ShouldTestTheNewProtocol_WhenTheUserChangesItInTheAdvancedFold', async () => {
    // Arrange
    const network = fakeNetwork({
      [BINDINGS]: ok([ptzCapability]),
      'PUT /api/cameras/camera-1/capabilities/ptz': ok(ptzCapability),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    const [, orientation] = await protocolRows()
    await userEvent.click(within(orientation).getByRole('button', { name: 'Modifier' }))
    const [, editedOrientation] = await protocolRows()
    // The list opens on the current protocol (ONVIF); the next one down is DVRIP.
    within(editedOrientation).getByRole('combobox', { name: 'Protocole' }).focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    // Act
    await userEvent.click(within(editedOrientation).getByRole('button', { name: 'Configurer' }))

    // Assert
    expect(await screen.findByText('Orientation : connexion réussie.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PUT /api/cameras/camera-1/capabilities/ptz',
        body: { protocol: 'dvrip', configJson: null },
      }),
    )
    const [, savedOrientation] = await protocolRows()
    expect(within(savedOrientation).getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
  })

  it('onConfigure_ShouldBeSuspendedWithTheReasonNearby_WhenTheStreamFails', async () => {
    // Arrange
    fakeNetwork({ [BINDINGS]: ok([privacyToConfigure]) })
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
      screen.getAllByText('Les autres capacités se vérifient une fois le flux vidéo rétabli.'),
    ).toHaveLength(2)
  })

  it('onTogglePtz_ShouldTurnOrientationOnAndReadTheCamerasAgain_WhenTheUserActivatesIt', async () => {
    // Arrange
    const network = fakeNetwork({
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
    const network = fakeNetwork({
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
    const network = fakeNetwork({
      [BINDINGS]: ok([makeCapabilityBinding()]),
      'DELETE /api/cameras/camera-1/capabilities/image_settings': ok(),
    })
    renderScreen(<CameraConnectionView />, connectionTab())
    await userEvent.click(await screen.findByRole('button', { name: 'Retirer' }))

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

  it('onConfigureManually_ShouldTestTheFirstCapabilityLeft_WhenTheUserKeepsTheDefaults', async () => {
    // Arrange
    const network = fakeNetwork({
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
        body: { protocol: 'v380', configJson: null },
      }),
    )
  })
})
