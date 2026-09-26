import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'
import { makeProfile } from '../../testing/profile_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { PersonCamerasView } from './person_cameras.component'

const LINKS = 'GET /api/profiles/person-1/camera-links'
const SAVE = 'PUT /api/profiles/person-1/camera-links'

const CAMERAS_TAB = {
  path: '/settings/detection/personnes/:profileId/cameras',
  url: '/settings/detection/personnes/person-1/cameras',
  outletContext: { person: makeProfile(), reload: () => undefined },
}

const frontDoor: ProfileCameraLink = {
  id: 'link-1',
  profileId: 'person-1',
  profileName: 'Alice',
  cameraId: 'camera-1',
  cameraDisplayName: 'Entrée',
  enabled: false,
}

async function tickTheFrontDoor() {
  const cameras = await screen.findByRole('combobox', { name: 'La reconnaître seulement sur' })
  cameras.focus()
  await userEvent.keyboard('{Enter}')
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Entrée' }))
}

describe('PersonCamerasView', () => {
  it('onLoad_ShouldSayThereIsNoCamera_WhenNoneIsInstalled', async () => {
    // Arrange
    fakeNetwork({ [LINKS]: ok([]) })

    // Act
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)

    // Assert
    expect(await screen.findByText('Aucune caméra pour l’instant.')).toBeInTheDocument()
  })

  it('onSave_ShouldLimitRecognitionToTheChosenCamera_WhenTheUserTicksIt', async () => {
    // Arrange
    const network = fakeNetwork({ [LINKS]: ok([frontDoor]), [SAVE]: ok([frontDoor]) })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
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
    fakeNetwork({ [LINKS]: ok([frontDoor]), [SAVE]: failure(500) })
    renderScreen(<PersonCamerasView />, CAMERAS_TAB)
    await tickTheFrontDoor()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/PUT \/api\/profiles\/person-1\/camera-links · 500/)).toBeVisible()
  })
})
