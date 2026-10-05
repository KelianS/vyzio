import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { AddCameraView } from './add_camera.component'

const reachable = {
  cameraId: 'camera-9',
  displayName: 'Porte',
  status: 'online',
  validationState: 'validated',
  connected: true,
  previewAvailable: true,
  needsAttention: false,
  guidance: null,
  lastReachabilityCheckAt: null,
  lastSuccessfulFrameAt: null,
}

const discovered = {
  displayName: 'Tapo C200',
  host: '192.168.1.60',
  port: 554,
  sourceType: 'onvif',
  streamPath: '/stream1',
  rtspActive: true,
  discoverySource: 'onvif',
  note: null,
  qualification: 'confirmed',
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

async function fillTheAddressByHand() {
  await userEvent.click(screen.getByRole('button', { name: 'Saisir l’adresse moi-même' }))
  await userEvent.type(screen.getByLabelText('Nom'), 'Porte')
  await userEvent.type(screen.getByLabelText('Adresse'), '192.168.1.50')
  await userEvent.type(screen.getByLabelText('Chemin du flux'), '/stream1')
}

describe('AddCameraView', () => {
  it('onCreate_ShouldAddTheCameraAndOpenIt_WhenTheVerifiedAddressIsAdded', async () => {
    // Arrange
    const network = fakeNetwork({
      'POST /api/cameras/verify-draft': ok(reachable),
      'POST /api/cameras': ok(makeCamera({ id: 'camera-9', displayName: 'Porte' })),
      'POST /api/cameras/camera-9/verify': ok(reachable),
      'GET /api/cameras': ok([makeCamera({ id: 'camera-9', displayName: 'Porte' })]),
      'GET /api/system/stats': ok(null),
    })
    const { router } = renderScreen(<AddCameraView />)
    await fillTheAddressByHand()
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier la connexion' }))
    await screen.findByText('Caméra joignable. Vous pouvez l’ajouter.')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la caméra' }))

    // Assert
    expect(await screen.findByText('« Porte » ajoutée.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings/cameras/camera-9')
    expect(network.sent).toContainEqual(expect.objectContaining({ route: 'GET /api/system/stats' }))
  })

  it('onVerifyDraft_ShouldSayTheCameraDoesNotAnswer_WhenTheCameraIsUnreachable', async () => {
    // Arrange
    fakeNetwork({
      'POST /api/cameras/verify-draft': failure(502, 'camera_unreachable', 'RTSP: timeout'),
    })
    renderScreen(<AddCameraView />)
    await fillTheAddressByHand()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier la connexion' }))

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('La caméra ne répond pas')
    expect(alert).toHaveTextContent('POST /api/cameras/verify-draft · 502')
    expect(screen.getByRole('button', { name: 'Ajouter la caméra' })).toBeDisabled()
  })

  it('onSelectCandidate_ShouldShowTheVendorNotice_WhenTheFoundCameraIsStillToPrepare', async () => {
    // Arrange
    fakeNetwork({
      'POST /api/cameras/discovery': ok({
        ranges: [],
        candidates: [{ ...discovered, streamPath: null, stream: null }],
      }),
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
      fakeNetwork({
        'POST /api/cameras/discovery': ok({ ranges: [], candidates: [discovered, overDvripOnly] }),
      })
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
      'POST /api/cameras/discovery': ok({
        ranges: [],
        candidates: [{ ...overDvripOnly, vendorFamily: 'icsee' }],
      }),
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
    fakeNetwork({
      'POST /api/cameras/discovery': ok({ ranges: [], candidates: [answeringNoStream] }),
    })
    renderScreen(<AddCameraView />)

    // Act
    await searchTheNetwork()

    // Assert
    expect(await screen.findByRole('button', { name: /Boîtier ONVIF/ })).toHaveTextContent(
      'À préparer',
    )
  })

  it('onCreate_ShouldAddTheCameraOverDvripWithoutAPath_WhenItsStreamIsReadyOverDvripOnly', async () => {
    // Arrange
    const network = fakeNetwork({
      'POST /api/cameras/discovery': ok({ ranges: [], candidates: [overDvripOnly] }),
      'POST /api/cameras': ok(makeCamera({ id: 'camera-9', displayName: 'ICSee salon' })),
      'POST /api/cameras/camera-9/verify': ok(reachable),
      'GET /api/cameras': ok([makeCamera({ id: 'camera-9', displayName: 'ICSee salon' })]),
      'GET /api/system/stats': ok(null),
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
        body: expect.objectContaining({
          stream: { protocol: 'dvrip', port: 34567, path: null },
        }) as unknown,
      }),
    )
  })

  it('onSelectCandidate_ShouldAskToOpenTheCameraFirst_WhenNoProtocolServesItsStream', async () => {
    // Arrange
    fakeNetwork({
      'POST /api/cameras/discovery': ok({ ranges: [], candidates: [answeringNoStream] }),
    })
    renderScreen(<AddCameraView />)
    await searchTheNetwork()

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /Boîtier ONVIF/ }))

    // Assert
    expect(screen.getByText('Cette caméra n’est pas encore joignable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter la caméra' })).not.toBeInTheDocument()
  })

  it('onDiscover_ShouldListTheSweptRangesWithTheirSource_WhenTheSearchEnds', async () => {
    // Arrange
    fakeNetwork({
      'POST /api/cameras/discovery': ok({
        ranges: [
          {
            cidr: '192.168.0.0/24',
            firstAddress: '192.168.0.1',
            lastAddress: '192.168.0.254',
            source: 'configured',
          },
          {
            cidr: '192.168.1.0/24',
            firstAddress: '192.168.1.1',
            lastAddress: '192.168.1.254',
            source: 'dashboard_address',
          },
        ],
        candidates: [],
      }),
    })
    renderScreen(<AddCameraView />)
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher sur le réseau' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rechercher' }),
    )

    // Assert
    expect(
      await screen.findByText('192.168.0.1 à 192.168.0.254 · plage configurée par défaut'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '192.168.1.1 à 192.168.1.254 · autour de l’adresse utilisée pour ouvrir Vyzio',
      ),
    ).toBeInTheDocument()
  })

  it('onDiscover_ShouldSayHowToGetASearch_WhenNoRangeWasSwept', async () => {
    // Arrange
    fakeNetwork({ 'POST /api/cameras/discovery': ok({ ranges: [], candidates: [] }) })
    renderScreen(<AddCameraView />)
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher sur le réseau' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rechercher' }),
    )

    // Assert
    expect(await screen.findByText(/Aucune adresse n’a été parcourue/)).toBeInTheDocument()
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
