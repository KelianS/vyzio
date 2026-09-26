import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeProfile, makeProfilePhoto } from '../../testing/profile_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { PersonPhotosView } from './person_photos.component'

const PHOTOS = 'GET /api/profiles/person-1/photos'
const UPLOAD = 'POST /api/profiles/person-1/photos'
const REMOVE = 'DELETE /api/profiles/person-1/photos/photo-1'
const RESYNC = 'POST /api/profiles/resync-face-library'

const PHOTOS_TAB = {
  path: '/settings/detection/personnes/:profileId/photos',
  url: '/settings/detection/personnes/person-1/photos',
  outletContext: { person: makeProfile(), reload: () => undefined },
}

describe('PersonPhotosView', () => {
  it('onLoad_ShouldSayRecognitionIsOff_WhenThePersonHasNoPhoto', async () => {
    // Arrange
    fakeNetwork({ [PHOTOS]: ok([]) })

    // Act
    renderScreen(<PersonPhotosView />, PHOTOS_TAB)

    // Assert
    expect(
      await screen.findByText('Aucune photo : la reconnaissance est inactive pour cette personne.'),
    ).toBeInTheDocument()
  })

  it('onLoad_ShouldShowEachPhotoAndWhetherItCounts_WhenThePersonHasSome', async () => {
    // Arrange
    fakeNetwork({ [PHOTOS]: ok([makeProfilePhoto({ frigateSynced: false })]) })

    // Act
    renderScreen(<PersonPhotosView />, PHOTOS_TAB)

    // Assert
    const photo = await screen.findByRole('listitem')
    expect(photo).toHaveTextContent('En attente')
  })

  it('onUpload_ShouldSendThePhotoAndSaySo_WhenTheUserPicksOne', async () => {
    // Arrange
    const network = fakeNetwork({ [PHOTOS]: ok([]), [UPLOAD]: ok(makeProfilePhoto()) })
    const { container } = renderScreen(<PersonPhotosView />, PHOTOS_TAB)
    await screen.findByRole('button', { name: 'Ajouter une photo' })
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!

    // Act
    await userEvent.upload(input, new File(['jpeg'], 'alice.jpg', { type: 'image/jpeg' }))

    // Assert
    expect(await screen.findByText('Photo ajoutée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(expect.objectContaining({ route: UPLOAD }))
  })

  it('onUpload_ShouldSayWhyAndForSupport_WhenThePhotoIsRefused', async () => {
    // Arrange
    fakeNetwork({ [PHOTOS]: ok([]), [UPLOAD]: failure(500) })
    const { container } = renderScreen(<PersonPhotosView />, PHOTOS_TAB)
    await screen.findByRole('button', { name: 'Ajouter une photo' })
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!

    // Act
    await userEvent.upload(input, new File(['jpeg'], 'alice.jpg', { type: 'image/jpeg' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/POST \/api\/profiles\/person-1\/photos · 500/)).toBeVisible()
  })

  it('onAskRemove_ShouldWarnItIsTheLastOne_WhenOnlyOnePhotoIsLeft', async () => {
    // Arrange
    fakeNetwork({ [PHOTOS]: ok([makeProfilePhoto()]) })
    renderScreen(<PersonPhotosView />, PHOTOS_TAB)
    const remove = await screen.findByRole('button', { name: 'Supprimer la photo alice-1.jpg' })

    // Act
    await userEvent.click(remove)

    // Assert
    expect(screen.getByRole('alertdialog')).toHaveTextContent('C’est la dernière')
  })

  it('onRemove_ShouldRemoveThePhoto_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({ [PHOTOS]: ok([makeProfilePhoto()]), [REMOVE]: ok() })
    renderScreen(<PersonPhotosView />, PHOTOS_TAB)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer la photo alice-1.jpg' }),
    )

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
    )

    // Assert
    expect(await screen.findByText('Photo supprimée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(expect.objectContaining({ route: REMOVE }))
  })

  it('onResync_ShouldSayHowManyPhotosWereTakenBack_WhenTheUserConfirms', async () => {
    // Arrange
    fakeNetwork({ [PHOTOS]: ok([]), [RESYNC]: ok({ synced: 4 }) })
    renderScreen(<PersonPhotosView />, PHOTOS_TAB)
    await userEvent.click(await screen.findByText('Avancé'))
    await userEvent.click(screen.getByRole('button', { name: 'Reprendre toutes les photos' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reprendre' }),
    )

    // Assert
    expect(await screen.findByText('4 photo(s) reprise(s).')).toBeInTheDocument()
  })
})
