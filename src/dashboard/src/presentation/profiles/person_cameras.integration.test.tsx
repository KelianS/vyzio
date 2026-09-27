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
  const cameras = await screen.findByRole('combobox', { name: 'La reconnaître seulement sur' })
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
      await screen.findByRole('combobox', { name: 'La reconnaître seulement sur' }),
    ).toBeInTheDocument()
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

  it('onSave_ShouldLimitRecognitionToTheChosenCamera_WhenTheUserTicksIt', async () => {
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
