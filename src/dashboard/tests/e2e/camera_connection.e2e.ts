import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeProtocol,
} from './fixtures/fake_backend'

/**
 * Editing and deleting a camera had become unreachable when the camera page was
 * taken out of the old screen: the use case still existed, no interface called it
 * any more. This journey keeps the door open.
 */
test.describe('CameraConnectionView', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
  })

  test('CameraConnectionView_ShouldSaveTheNameThroughTheDraft_WhenTheUserRenamesTheCamera', async ({
    page,
  }) => {
    const name = page.getByRole('textbox', { name: 'Nom' })
    await expect(name).toHaveValue('Porte d’entrée')

    await name.fill('Portail')

    const bar = page.getByRole('region', { name: 'Modifications en attente' })
    await expect(bar).toContainText('Nom')

    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(bar).toBeHidden()

    // The name travels up to the page title, and so up to the shared catalogue.
    await expect(page.getByRole('heading', { name: 'Portail' })).toBeVisible()
  })

  test('CameraConnectionView_ShouldSaveTheStreamAddressThroughTheDraft_WhenTheUserFixesItInAdvanced', async ({
    page,
  }) => {
    await page.locator('summary', { hasText: 'Avancé' }).click()
    await page.getByRole('textbox', { name: 'Adresse' }).fill('192.168.1.51')

    const bar = page.getByRole('region', { name: 'Modifications en attente' })
    await expect(bar).toContainText('Adresse')

    await bar.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(bar).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Adresse' })).toHaveValue('192.168.1.51')
  })

  test('CameraConnectionView_ShouldConfirmThenLandOnTheList_WhenTheUserDeletesTheCamera', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Supprimer cette caméra' }).click()
    await expect(page.getByText('Supprimer « Porte d’entrée » ?')).toBeVisible()

    await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
    await expect(page).toHaveURL('/settings/cameras')
  })
})

// Each connection detail sits on its level: each stream in its card options, a port and a specific account in its protocol box (ADR-61).
test.describe('CameraConnectionView three levels', () => {
  test('CameraConnectionView_ShouldSaveThePortAndSpecificAccountOfAProtocol_WhenTheUserEditsItsBox', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.protocols = [
      makeFakeProtocol(),
      makeFakeProtocol({ protocol: 'tapo_klap', effectivePort: 80 }),
    ]
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')
    await page.locator('summary', { hasText: 'Avancé' }).click()
    const klap = page.getByRole('listitem', { name: 'Tapo KLAP' })

    await klap.getByRole('spinbutton', { name: 'Port' }).fill('8080')
    await klap.getByRole('switch', { name: 'Compte spécifique' }).click()
    await klap.getByRole('textbox', { name: 'Identifiant' }).fill('compte-cloud')

    const bar = page.getByRole('region', { name: 'Modifications en attente' })
    await expect(bar).toContainText('Protocoles')
    await expect(bar).not.toContainText('KLAP')

    await bar.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(bar).toBeHidden()
    await expect(klap.getByRole('spinbutton', { name: 'Port' })).toHaveValue('8080')
    await expect(klap.getByRole('switch', { name: 'Compte spécifique' })).toBeChecked()
  })

  test('CameraConnectionView_ShouldAddThenRemoveAProtocol_WhenNoCapabilityGoesThroughIt', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
    await page.locator('summary', { hasText: 'Avancé' }).click()

    await page.getByRole('button', { name: 'Ajouter un protocole' }).click()
    const form = page.getByRole('group', { name: 'Ajouter un protocole' })
    await form.getByRole('button', { name: 'Ajouter et vérifier' }).click()
    await expect(page.getByText('Protocole ajouté.')).toBeVisible()

    const onvif = page.getByRole('listitem', { name: 'ONVIF' })
    await expect(onvif).toContainText('Répond')
    await expect(
      page.getByRole('listitem', { name: 'RTSP' }).getByRole('button', { name: 'Retirer' }),
    ).toBeDisabled()

    await onvif.getByRole('button', { name: 'Retirer' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Retirer' }).click()
    await expect(page.getByText('Protocole retiré.')).toBeVisible()
    await expect(onvif).toHaveCount(0)
  })

  test('CameraConnectionView_ShouldOfferToAddACapabilityAfterTheCards_WhenOneIsLeftToAdd', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.protocols.push(makeFakeProtocol({ protocol: 'onvif', effectivePort: 2020 }))
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')

    await page.getByRole('button', { name: 'Ajouter une capacité' }).click()
    await expect(page.getByText('Configurer manuellement')).toBeVisible()
  })

  test('CameraConnectionView_ShouldShowEachStreamFixedWithItsPathInTheTooltip_WhenTheStreamOptionsOpen', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
    const stream = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem').first()

    await stream.getByText('Options').click()
    const main = stream.getByRole('listitem', { name: '1920 × 1080 · 15 img/s' })
    await main.getByRole('button', { name: 'Comment Vyzio reçoit-il ce flux ?' }).click()

    await expect(page.getByText('Par RTSP, chemin /Streaming/Channels/101.')).toBeVisible()
    await expect(stream.getByRole('combobox', { name: 'Flux', exact: true })).toHaveCount(0)
    await expect(stream.getByRole('textbox', { name: 'Chemin du flux' })).toHaveCount(0)
  })
})

// Each stream is a line of the stream card, with its role and its own state (ADR-65).
test.describe('CameraConnectionView stream lines', () => {
  test('CameraConnectionView_ShouldBringARemovedStreamBackFromTheCamerasList_WhenTheUserAddsItAgain', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
    const stream = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem').first()
    await stream.getByText('Options').click()
    const sub = stream.getByRole('listitem', { name: '640 × 360 · 10 img/s' })

    await sub.getByRole('button', { name: 'Retirer' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Retirer' }).click()
    await expect(sub).toHaveCount(0)
    await expect(stream.getByText('La détection passe par le flux d’enregistrement.')).toBeVisible()

    await stream.getByRole('button', { name: 'Ajouter un flux' }).click()
    const form = page.getByRole('group', { name: 'Ajouter un flux' })
    await expect(form.getByRole('combobox', { name: 'Flux' })).toContainText('640 × 360 · 10 img/s')
    await form.getByRole('button', { name: 'Ajouter et vérifier' }).click()

    await expect(sub).toBeVisible()
  })

  test('CameraConnectionView_ShouldKeepRecordingOnOneStream_WhenTheUserGivesItToAnother', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
    const stream = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem').first()
    await stream.getByText('Options').click()
    const main = stream.getByRole('listitem', { name: '1920 × 1080 · 15 img/s' })
    const sub = stream.getByRole('listitem', { name: '640 × 360 · 10 img/s' })
    await expect(main.getByRole('button', { name: 'Retirer' })).toBeDisabled()

    await sub.getByRole('combobox', { name: 'Rôle' }).click()
    await page.getByRole('option', { name: 'Enregistrement et détection' }).click()

    await expect(main.getByRole('combobox', { name: 'Rôle' })).toContainText('Aucun')
    await expect(main.getByRole('button', { name: 'Retirer' })).toBeEnabled()
    await expect(sub.getByRole('button', { name: 'Retirer' })).toBeDisabled()
  })
})

// The stream is checked like any other capability, from its own card (DESIGN SYSTEM § Capability cards).
test.describe('CameraConnectionView capability cards', () => {
  test('CameraConnectionView_ShouldConfirmEachCapabilityWorks_WhenTheUserChecksThem', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: true })] })
    state.ptzBinding = { protocol: 'onvif', configJson: null }
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')
    const cards = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem')

    await cards.filter({ hasText: 'Flux vidéo' }).getByRole('button', { name: 'Vérifier' }).click()
    await expect(page.getByText('Flux vidéo : connexion réussie.')).toBeVisible()

    await cards.filter({ hasText: 'Orientation' }).getByRole('button', { name: 'Vérifier' }).click()
    await expect(page.getByText('Orientation : connexion réussie.')).toBeVisible()
  })
})

// A camera added before the three levels has no protocol yet: detection finds them (ADR-61 d).
test.describe('CameraConnectionView camera without protocols', () => {
  function cameraWithoutProtocols() {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ status: 'offline' })],
    })
    state.streamBinding = { protocol: 'rtsp', lastError: null, configured: false }
    state.protocols = []
    state.discoverableProtocols = [makeFakeProtocol({ protocol: 'dvrip', effectivePort: 34567 })]
    return state
  }

  test('CameraConnectionView_ShouldBindTheStreamToTheProtocolFound_WhenTheUserDetectsAutomatically', async ({
    page,
  }) => {
    await installFakeBackend(page, cameraWithoutProtocols())
    await page.goto('/settings/cameras/camera-1/connexion')
    const stream = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem').first()
    await expect(stream).toContainText('Détecter automatiquement')
    await expect(stream.getByText('Options', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Détecter automatiquement' }).click()
    await expect(page.getByText('Détection terminée.')).toBeVisible()

    await stream.getByText('Options', { exact: true }).click()
    await expect(stream.getByRole('combobox', { name: 'Protocole' })).toContainText('DVRIP')
  })

  test('CameraConnectionView_ShouldListTheProtocolsFoundWithoutBindingAny_WhenTheUserSearchesThem', async ({
    page,
  }) => {
    await installFakeBackend(page, cameraWithoutProtocols())
    await page.goto('/settings/cameras/camera-1/connexion')
    await page.locator('summary', { hasText: 'Avancé' }).click()

    await page.getByRole('button', { name: 'Rechercher les protocoles' }).click()
    await expect(page.getByText('Recherche terminée.')).toBeVisible()

    await expect(page.getByRole('listitem', { name: 'DVRIP' })).toContainText('Répond')
    const stream = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem').first()
    await expect(stream).toContainText('Choisissez comment Vyzio lit les images')
  })
})
