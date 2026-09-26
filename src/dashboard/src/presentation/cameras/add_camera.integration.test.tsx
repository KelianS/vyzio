import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
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
  macAddress: null,
  isSupported: true,
  qualification: 'confirmed',
  supportLevel: 'supported',
  vendorFamily: 'tplink_tapo',
  qualificationReasons: [],
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
    expect(router.state.location.pathname).toBe('/settings/cameras/camera-9/detection')
    expect(network.sent.map((request) => request.route)).toContain('GET /api/system/stats')
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

  it('onSelectCandidate_ShouldShowTheVendorNotice_WhenTheUserPicksAFoundCamera', async () => {
    // Arrange
    fakeNetwork({
      'POST /api/cameras/discovery': ok([discovered]),
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
