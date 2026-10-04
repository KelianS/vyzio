import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { AddCameraView } from './add_camera.component'

const discovered = {
  displayName: 'Tapo C200',
  host: '192.168.1.60',
  port: 554,
  sourceType: 'onvif',
  streamPath: '/stream1',
  rtspActive: true,
  discoverySource: 'onvif',
  note: null,
  macAddress: null,
  isSupported: true,
  qualification: 'confirmed',
  supportLevel: 'supported',
  vendorFamily: 'tplink_tapo',
  qualificationReasons: [],
  stream: { protocol: 'rtsp', port: 554, path: '/stream1' },
}

const overDvripOnly = {
  ...discovered,
  displayName: 'ICSee salon',
  host: '192.168.1.61',
  port: 34567,
  streamPath: null,
  rtspActive: false,
  vendorFamily: null,
  qualificationReasons: ['camera_port_open', 'dvrip_port_detected'],
  stream: { protocol: 'dvrip', port: 34567, path: null },
}

const answeringNoStream = {
  ...discovered,
  displayName: 'Boîtier ONVIF',
  host: '192.168.1.62',
  streamPath: null,
  rtspActive: false,
  vendorFamily: null,
  qualificationReasons: ['camera_port_open', 'onvif_port_detected'],
  stream: null,
}

async function searchTheNetwork() {
  await userEvent.click(screen.getByRole('button', { name: 'Rechercher sur le réseau' }))
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rechercher' }),
  )
}

async function fillTheAccessByHand() {
  await userEvent.click(screen.getByRole('button', { name: 'Saisir l’adresse moi-même' }))
  await userEvent.type(screen.getByLabelText('Nom'), 'Porte')
  await userEvent.type(screen.getByLabelText('Adresse'), '192.168.1.50')
  await userEvent.type(screen.getByLabelText('Identifiant'), 'viewer')
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'not-a-real-secret')
}

describe('AddCameraView', () => {
  it('onCreate_ShouldCreateTheCameraFromItsAccessAloneAndOpenIt_WhenTheTypedAddressIsAdded', async () => {
    // Arrange
    const network = fakeNetwork({
      'POST /api/cameras': ok(makeCamera({ id: 'camera-9', displayName: 'Porte' })),
      'GET /api/cameras': ok([makeCamera({ id: 'camera-9', displayName: 'Porte' })]),
    })
    const { router } = renderScreen(<AddCameraView />)
    await fillTheAccessByHand()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la caméra' }))

    // Assert
    expect(await screen.findByText('« Porte » ajoutée.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings/cameras/camera-9')
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'POST /api/cameras',
        body: {
          displayName: 'Porte',
          host: '192.168.1.50',
          username: 'viewer',
          password: 'not-a-real-secret',
        },
      }),
    )
  })

  it('onSelectManualEntry_ShouldAskForTheAccessAlone_WhenTheUserTypesTheAddress', async () => {
    // Arrange
    fakeNetwork({})
    renderScreen(<AddCameraView />)

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Saisir l’adresse moi-même' }))

    // Assert
    expect(screen.getByLabelText('Nom')).toBeInTheDocument()
    expect(screen.queryByLabelText('Port')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Chemin du flux')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Marque')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vérifier la connexion' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter la caméra' })).toBeDisabled()
  })

  it('onCreate_ShouldSayWhyAndForSupportAndStay_WhenTheCameraCannotBeCreated', async () => {
    // Arrange
    fakeNetwork({ 'POST /api/cameras': failure(400, 'invalid_camera') })
    const { router } = renderScreen(<AddCameraView />)
    await fillTheAccessByHand()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la caméra' }))

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('POST /api/cameras · 400')
    expect(router.state.location.pathname).not.toBe('/settings/cameras/camera-9')
    expect(screen.getByRole('button', { name: 'Ajouter la caméra' })).toBeEnabled()
  })

  it('onSelectCandidate_ShouldShowTheVendorNotice_WhenTheFoundCameraIsStillToPrepare', async () => {
    // Arrange
    fakeNetwork({
      'POST /api/cameras/discovery': ok([{ ...discovered, streamPath: null, stream: null }]),
      'POST /api/cameras/vendor-assistance': ok({
        vendorFamily: 'tplink_tapo',
        markdown: 'Activez le compte caméra dans l’application Tapo.',
      }),
    })
    renderScreen(<AddCameraView />)
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher sur le réseau' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rechercher' }),
    )

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /Tapo C200/ }))

    // Assert
    expect(
      await screen.findByText('Activez le compte caméra dans l’application Tapo.'),
    ).toBeInTheDocument()
  })

  it.each([[/Tapo C200/], [/ICSee salon/]])(
    'onDiscover_ShouldMarkTheCameraReady_WhenAProtocolServesItsStream: %s',
    async (name) => {
      // Arrange
      fakeNetwork({ 'POST /api/cameras/discovery': ok([discovered, overDvripOnly]) })
      renderScreen(<AddCameraView />)

      // Act
      await searchTheNetwork()

      // Assert
      expect(await screen.findByRole('button', { name })).toHaveTextContent('Prête')
    },
  )

  it('onSelectCandidate_ShouldSkipTheActivationNotice_WhenTheFoundCameraIsReadyOverDvrip', async () => {
    // Arrange
    const network = fakeNetwork({
      'POST /api/cameras/discovery': ok([{ ...overDvripOnly, vendorFamily: 'icsee' }]),
      'POST /api/cameras/vendor-assistance': ok(null),
    })
    renderScreen(<AddCameraView />)
    await searchTheNetwork()

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /ICSee salon/ }))

    // Assert
    await waitFor(() =>
      expect(network.sent).toContainEqual(
        expect.objectContaining({
          route: 'POST /api/cameras/vendor-assistance',
          body: expect.objectContaining({ connected: true }) as unknown,
        }),
      ),
    )
  })

  it('onDiscover_ShouldMarkTheCameraToPrepare_WhenNoProtocolServesItsStream', async () => {
    // Arrange
    fakeNetwork({ 'POST /api/cameras/discovery': ok([answeringNoStream]) })
    renderScreen(<AddCameraView />)

    // Act
    await searchTheNetwork()

    // Assert
    expect(await screen.findByRole('button', { name: /Boîtier ONVIF/ })).toHaveTextContent(
      'À préparer',
    )
  })

  it('onCreate_ShouldHandOverTheNameAndAddressOnly_WhenADiscoveredCameraIsAdded', async () => {
    // Arrange
    const network = fakeNetwork({
      'POST /api/cameras/discovery': ok([overDvripOnly]),
      'POST /api/cameras': ok(makeCamera({ id: 'camera-9', displayName: 'ICSee salon' })),
      'GET /api/cameras': ok([makeCamera({ id: 'camera-9', displayName: 'ICSee salon' })]),
    })
    renderScreen(<AddCameraView />)
    await searchTheNetwork()
    await userEvent.click(await screen.findByRole('button', { name: /ICSee salon/ }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la caméra' }))

    // Assert
    expect(await screen.findByText('« ICSee salon » ajoutée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'POST /api/cameras',
        body: { displayName: 'ICSee salon', host: '192.168.1.61', username: null, password: null },
      }),
    )
  })

  it('onSelectCandidate_ShouldAskToOpenTheCameraFirst_WhenNoProtocolServesItsStream', async () => {
    // Arrange
    fakeNetwork({ 'POST /api/cameras/discovery': ok([answeringNoStream]) })
    renderScreen(<AddCameraView />)
    await searchTheNetwork()

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /Boîtier ONVIF/ }))

    // Assert
    expect(screen.getByText('Cette caméra n’est pas encore joignable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter la caméra' })).not.toBeInTheDocument()
  })

  it('onDiscover_ShouldSayWhyAndForSupport_WhenTheSearchFails', async () => {
    // Arrange
    fakeNetwork({ 'POST /api/cameras/discovery': failure(500) })
    renderScreen(<AddCameraView />)
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher sur le réseau' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rechercher' }),
    )

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('POST /api/cameras/discovery · 500')
  })
})
