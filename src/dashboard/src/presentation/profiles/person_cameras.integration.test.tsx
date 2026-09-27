import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { makeProfile } from '../../testing/profile_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { readTheCameraList } from '../../testing/shared_reads'
import { PersonCamerasView } from './person_cameras.component'

const CAMERAS = 'GET /api/cameras'
const LINKS = 'GET /api/profiles/person-1/camera-links'
const SAVE = 'PUT /api/profiles/person-1/camera-links'

const CAMERAS_TAB = {
  path: '/settings/detection/personnes/:profileId/cameras',
  url: '/settings/detection/personnes/person-1/cameras',
  outletContext: { person: makeProfile(), reload: () => undefined },
}

const installed = [
  makeCamera({ id: 'camera-1', displayName: 'Entrée' }),
  makeCamera({ id: 'camera-2', slug: 'jardin', displayName: 'Jardin' }),
]

const frontDoor: ProfileCameraLink = {
  id: 'link-1',
  profileId: 'person-1',
  profileName: 'Alice',
  cameraId: 'camera-1',
  cameraDisplayName: 'Entrée',
  enabled: true,
}

async function openTheCameras() {
  const cameras = await screen.findByRole('combobox', { name: 'Me notifier seulement sur' })
  cameras.focus()
  await userEvent.keyboard('{Enter}')
}

async function tickTheFrontDoor() {
  await openTheCameras()
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Entrée' }))
}

describe('PersonCamerasView', () => {
  it('onLoad_ShouldSayThereIsNoCamera_WhenNoneIsInstalled', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok([]), [LINKS]: ok([]) })

    // Act
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()

    // Assert
    expect(await screen.findByText('Aucune caméra pour l’instant.')).toBeInTheDocument()
  })

  it('onLoad_ShouldSayWhyAndForSupport_WhenTheCameraListFails', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: failure(500), [LINKS]: ok([]) })

    // Act
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/cameras · 500/)).toBeVisible()
    expect(screen.getByText('La liste de vos caméras n’a pas pu être lue.')).toBeInTheDocument()
    expect(screen.queryByText('Aucune caméra pour l’instant.')).not.toBeInTheDocument()
  })

  it('onReloadCameras_ShouldOfferTheCameras_WhenTheRetryReadsTheList', async () => {
    // Arrange
    const network = fakeNetwork({ [CAMERAS]: failure(500), [LINKS]: ok([]) })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()
    network.answer(CAMERAS, ok(installed))

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(
      await screen.findByRole('combobox', { name: 'Me notifier seulement sur' }),
    ).toBeInTheDocument()
  })

  it('onLoad_ShouldSayWhyAndForSupport_WhenTheCameraLinksCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok(installed), [LINKS]: failure(500) })

    // Act
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('GET /api/profiles/person-1/camera-links · 500')
    expect(
      screen.getByText('Les caméras choisies pour cette personne n’ont pas pu être lues.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldOfferTheCameras_WhenTheRetryReadsTheLinks', async () => {
    // Arrange
    const network = fakeNetwork({ [CAMERAS]: ok(installed), [LINKS]: failure(500) })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()
    await screen.findByRole('alert')
    network.answer(LINKS, ok([frontDoor]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(
      await screen.findByRole('combobox', { name: 'Me notifier seulement sur' }),
    ).toHaveTextContent('Entrée')
  })

  it('onLoad_ShouldOfferEveryCameraUnticked_WhenThePersonIsLinkedToNone', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok(installed), [LINKS]: ok([]) })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()

    // Act
    await openTheCameras()

    // Assert
    expect(await screen.findByRole('checkbox', { name: 'Entrée' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Jardin' })).not.toBeChecked()
  })

  it('onLoad_ShouldSayEveryCameraSignalsThePerson_WhenNoneIsTicked', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok(installed), [LINKS]: ok([]) })

    // Act
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()

    // Assert
    expect(
      await screen.findByRole('combobox', { name: 'Me notifier seulement sur' }),
    ).toHaveTextContent('Toutes les caméras')
  })

  it('onLoad_ShouldSayThePersonIsNeverSignalledAndOfferNoChoice_WhenTheirAlertsAreOff', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok(installed), [LINKS]: ok([]) })
    const silenced = {
      ...CAMERAS_TAB,
      outletContext: { person: makeProfile({ alertMode: 'never' }), reload: () => undefined },
    }

    // Act
    renderScreen(<PersonCamerasView />, silenced)
    await readTheCameraList()

    // Assert
    expect(
      await screen.findByText(
        /Aucune notification n’est envoyée pour le passage de cette personne/,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldTickOnlyTheLinkedCamera_WhenThePersonIsLinkedToOne', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok(installed), [LINKS]: ok([frontDoor]) })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()

    // Act
    await openTheCameras()

    // Assert
    expect(await screen.findByRole('checkbox', { name: 'Entrée' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Jardin' })).not.toBeChecked()
  })

  it('onSave_ShouldLimitAlertsToTheChosenCamera_WhenTheUserTicksIt', async () => {
    // Arrange
    const network = fakeNetwork({
      [CAMERAS]: ok(installed),
      [LINKS]: ok([]),
      [SAVE]: ok([frontDoor]),
    })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()
    await tickTheFrontDoor()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Caméras enregistrées.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: SAVE, body: { cameraIds: ['camera-1'] } }),
    )
  })

  it('onSave_ShouldShowTheSavedChoiceWithoutReadingAgain_WhenTheSaveSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({
      [CAMERAS]: ok(installed),
      [LINKS]: ok([]),
      [SAVE]: ok([frontDoor]),
    })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()
    await tickTheFrontDoor()
    network.answer(LINKS, failure(500))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Caméras enregistrées.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Me notifier seulement sur' })).toHaveTextContent(
      'Entrée',
    )
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onLoad_ShouldStillSayWhyThereIsNoChoice_WhenThePersonIsNeverSignalledAndTheLinksFail', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok(installed), [LINKS]: failure(500) })
    const silenced = {
      ...CAMERAS_TAB,
      outletContext: { person: makeProfile({ alertMode: 'never' }), reload: () => undefined },
    }

    // Act
    renderScreen(<PersonCamerasView />, silenced)
    await readTheCameraList()

    // Assert
    expect(
      await screen.findByText(
        /Aucune notification n’est envoyée pour le passage de cette personne/,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('onSave_ShouldSayWhyAndForSupport_WhenTheSaveFails', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok(installed), [LINKS]: ok([]), [SAVE]: failure(500) })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await readTheCameraList()
    await tickTheFrontDoor()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/PUT \/api\/profiles\/person-1\/camera-links · 500/)).toBeVisible()
  })
})
