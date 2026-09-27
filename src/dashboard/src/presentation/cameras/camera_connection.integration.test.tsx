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
const CAMERAS = 'GET /api/cameras'
const STATS = 'GET /api/system/stats'

const camera = makeCamera()
const ptzCapability = makeCapabilityBinding({ capability: 'ptz', protocol: 'onvif' })
const privacyToConfigure = makeCapabilityBinding({
  capability: 'hardware_privacy',
  protocol: 'tapo_klap',
  verified: false,
  isConfigured: false,
})

function connectionTab() {
  return {
    path: '/settings/cameras/:cameraId/connexion',
    url: '/settings/cameras/camera-1/connexion',
    outletContext: camera,
  }
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

  it('onVerify_ShouldSayTheCameraIsUnreachable_WhenItDoesNotAnswer', async () => {
    // Arrange
    fakeNetwork({ [BINDINGS]: ok([]), [VERIFY]: ok({ connected: false }), [CAMERAS]: ok([]) })
    renderScreen(<CameraConnectionView />, connectionTab())

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Vérifier la connexion' }))

    // Assert
    expect(
      await screen.findByText('Caméra injoignable : vérifiez ces réglages.'),
    ).toBeInTheDocument()
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

  it('onLoad_ShouldListEachCapabilityWithItsProtocol_WhenTheCameraHasSome', async () => {
    // Arrange
    fakeNetwork({ [BINDINGS]: ok([ptzCapability]) })

    // Act
    renderScreen(<CameraConnectionView />, connectionTab())

    // Assert
    const row = await screen.findByRole('listitem')
    expect(row).toHaveTextContent('PTZ')
    expect(row).toHaveTextContent('ONVIF')
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
    expect(
      screen.queryByRole('button', { name: 'Configurer une capacité manuellement' }),
    ).not.toBeInTheDocument()
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
    expect(await screen.findByRole('listitem')).toHaveTextContent('PTZ')
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
    await screen.findByRole('listitem')
    network.answer(BINDINGS, failure(500))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Détecter les capacités' }))

    // Assert
    expect(
      await screen.findByText(/GET \/api\/cameras\/camera-1\/capabilities · 500/),
    ).toBeVisible()
    expect(screen.getByRole('listitem')).toHaveTextContent('PTZ')
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
    expect(
      await screen.findByText('Vie privée matérielle : connexion réussie.'),
    ).toBeInTheDocument()
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

  it('onTogglePtz_ShouldTurnPtzOnAndReadTheCamerasAgain_WhenTheUserActivatesIt', async () => {
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
    expect(await screen.findByText('PTZ activé.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: UPDATE,
        body: expect.objectContaining({ ptzSupported: true, password: null }),
      }),
    )
    expect(network.sent).toContainEqual(expect.objectContaining({ route: CAMERAS }))
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
    expect(await screen.findByText('Réglages image retiré.')).toBeInTheDocument()
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
    await userEvent.click(
      await screen.findByRole('button', { name: 'Configurer une capacité manuellement' }),
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Configurer' }))

    // Assert
    expect(
      await screen.findByRole('button', { name: 'Configurer une capacité manuellement' }),
    ).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PUT /api/cameras/camera-1/capabilities/ptz',
        body: { protocol: 'v380', configJson: null },
      }),
    )
  })
})
