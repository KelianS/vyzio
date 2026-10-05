import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
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

async function fillTheAccessByHand() {
  await userEvent.click(screen.getByRole('button', { name: 'Saisir l’adresse moi-même' }))
  await userEvent.type(screen.getByLabelText('Nom'), 'Porte')
  await userEvent.type(screen.getByLabelText('Adresse'), '192.168.1.50')
  await userEvent.type(screen.getByLabelText('Identifiant'), 'viewer')
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'not-a-real-secret')
}

async function chooseHelpVendor(name: string) {
  screen.getByRole('combobox', { name: 'Marque' }).focus()
  await userEvent.keyboard('{ArrowDown}')
  await userEvent.click(await screen.findByRole('option', { name }))
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
    expect(alert).toHaveTextContent('La demande n’a pas abouti')
    expect(alert).toHaveTextContent('POST /api/cameras · 400')
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('button', { name: 'Ajouter la caméra' })).toBeEnabled()
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
    expect(screen.getByRole('combobox', { name: 'Marque' })).toHaveTextContent('TP-Link Tapo')
  })

  it('onSelectManualEntry_ShouldShowTheGeneralHelpForAnotherBrand_WhenTheUserTypesTheAddress', async () => {
    // Arrange
    fakeNetwork({})
    renderScreen(<AddCameraView />)

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Saisir l’adresse moi-même' }))

    // Assert
    expect(screen.getByText('Aide de votre caméra')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Marque' })).toHaveTextContent('Autre marque')
    expect(
      screen.getByText(/^Ouvrez l’application de la caméra et créez-y un compte/),
    ).toBeVisible()
  })

  it.each([
    { label: 'V380 PRO', vendorFamily: 'v380_pro' },
    { label: 'TP-Link Tapo', vendorFamily: 'tplink_tapo' },
    { label: 'ICSee / XMEye', vendorFamily: 'icsee' },
  ])(
    'onHelpVendorChosen_ShouldShowThatVendorsSheet_WhenTheCameraToPrepareCarriesADiscoveredPath ($vendorFamily)',
    async ({ label, vendorFamily }) => {
      // Arrange
      const network = fakeNetwork({
        'POST /api/cameras/discovery': ok({
          ranges: [],
          candidates: [{ ...answeringNoStream, streamPath: '/onvif1' }],
        }),
        'POST /api/cameras/vendor-assistance': ok({ vendorFamily, markdown: `Fiche ${label}` }),
      })
      renderScreen(<AddCameraView />)
      await searchTheNetwork()
      await userEvent.click(await screen.findByRole('button', { name: /Boîtier ONVIF/ }))

      // Act
      await chooseHelpVendor(label)

      // Assert
      expect(await screen.findByText(`Fiche ${label}`)).toBeInTheDocument()
      expect(network.sent).toContainEqual(
        expect.objectContaining({
          route: 'POST /api/cameras/vendor-assistance',
          body: { vendorFamily },
        }),
      )
    },
  )

  it('onHelpVendorChosen_ShouldShowThatVendorsNoticeAndNeverSendIt_WhenTheTypedAddressIsAdded', async () => {
    // Arrange
    const network = fakeNetwork({
      'POST /api/cameras/vendor-assistance': ok({
        vendorFamily: 'icsee',
        markdown: 'Créez le compte caméra dans l’application ICSee.',
      }),
      'POST /api/cameras': ok(makeCamera({ id: 'camera-9', displayName: 'Porte' })),
      'GET /api/cameras': ok([makeCamera({ id: 'camera-9', displayName: 'Porte' })]),
    })
    renderScreen(<AddCameraView />)
    await fillTheAccessByHand()

    // Act
    await chooseHelpVendor('ICSee / XMEye')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la caméra' }))

    // Assert
    expect(
      await screen.findByText('Créez le compte caméra dans l’application ICSee.'),
    ).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'POST /api/cameras/vendor-assistance',
        body: { vendorFamily: 'icsee' },
      }),
    )
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

  it('onDiscover_ShouldNameTheVendorAsTextWithoutAPill_WhenDiscoveryRecognisesIt', async () => {
    // Arrange
    fakeNetwork({
      'POST /api/cameras/discovery': ok({
        ranges: [],
        candidates: [discovered, answeringNoStream],
      }),
    })
    renderScreen(<AddCameraView />)

    // Act
    await searchTheNetwork()

    // Assert
    expect(await screen.findByRole('button', { name: /Tapo C200/ })).toHaveTextContent(
      '192.168.1.60 · TP-Link Tapo',
    )
    expect(screen.getByRole('button', { name: /Boîtier ONVIF/ })).not.toHaveTextContent('Marque')
  })

  it('onSelectCandidate_ShouldOfferNoHelpList_WhenTheFoundCameraIsReady', async () => {
    // Arrange
    fakeNetwork({
      'POST /api/cameras/discovery': ok({ ranges: [], candidates: [discovered] }),
      'POST /api/cameras/vendor-assistance': ok(null),
    })
    renderScreen(<AddCameraView />)
    await searchTheNetwork()

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /Tapo C200/ }))

    // Assert
    expect(screen.getByLabelText('Nom')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Marque' })).not.toBeInTheDocument()
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

  it('onSelectCandidate_ShouldAskForNoVendorSheet_WhenTheFoundCameraIsReadyOverDvrip', async () => {
    // Arrange
    const network = fakeNetwork({
      'POST /api/cameras/discovery': ok({
        ranges: [],
        candidates: [{ ...overDvripOnly, vendorFamily: 'icsee' }],
      }),
    })
    renderScreen(<AddCameraView />)
    await searchTheNetwork()

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /ICSee salon/ }))

    // Assert
    expect(await screen.findByLabelText('Nom')).toBeInTheDocument()
    expect(network.sent.map((request) => request.route)).not.toContain(
      'POST /api/cameras/vendor-assistance',
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

  it('onCreate_ShouldHandOverTheNameAndAddressOnly_WhenADiscoveredCameraIsAdded', async () => {
    // Arrange
    const network = fakeNetwork({
      'POST /api/cameras/discovery': ok({ ranges: [], candidates: [overDvripOnly] }),
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

  it('onDiscover_ShouldListTheSweptRangesWithTheirSourceUnderAdvanced_WhenTheSearchEnds', async () => {
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

    await userEvent.click(await screen.findByText('Avancé'))

    // Assert
    expect(
      screen.getByText('192.168.0.1 à 192.168.0.254 · plage configurée par défaut'),
    ).toBeVisible()
    expect(
      screen.getByText(
        '192.168.1.1 à 192.168.1.254 · autour de l’adresse utilisée pour ouvrir Vyzio',
      ),
    ).toBeVisible()
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

  it('onDiscover_ShouldNotSayNothingWasSwept_WhenListedHostsStillFoundACamera', async () => {
    // Arrange
    fakeNetwork({ 'POST /api/cameras/discovery': ok({ ranges: [], candidates: [discovered] }) })
    renderScreen(<AddCameraView />)

    // Act
    await searchTheNetwork()

    // Assert
    expect(await screen.findByRole('button', { name: /Tapo C200/ })).toBeInTheDocument()
    expect(screen.queryByText(/Aucune adresse n’a été parcourue/)).not.toBeInTheDocument()
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
