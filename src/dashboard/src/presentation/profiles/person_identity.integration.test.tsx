import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeProfile } from '../../testing/profile_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { PersonIdentityView } from './person_identity.component'

const UPDATE = 'PUT /api/profiles/person-1'
const DELETE = 'DELETE /api/profiles/person-1'

function identityTab(reload: () => void) {
  return {
    path: '/settings/detection/personnes/:profileId/identite',
    url: '/settings/detection/personnes/person-1/identite',
    outletContext: { person: makeProfile(), reload },
  }
}

async function renameToBob() {
  const name = await screen.findByLabelText('Nom')
  await userEvent.clear(name)
  await userEvent.type(name, 'Bob')
}

describe('PersonIdentityView', () => {
  it('onSave_ShouldSaveAndLetTheShellReadTheName_WhenTheUserRenamesThePerson', async () => {
    // Arrange
    const reload = vi.fn()
    const network = fakeNetwork({ [UPDATE]: ok(makeProfile({ name: 'Bob' })) })
    renderScreen(<PersonIdentityView />, identityTab(reload))
    await renameToBob()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Identité enregistrée.')).toBeInTheDocument()
    expect(reload).toHaveBeenCalled()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: UPDATE,
        body: { name: 'Bob', category: 'family', alertMode: 'always' },
      }),
    )
  })

  it('onSave_ShouldKeepTheDraftAndSayWhy_WhenTheSaveFails', async () => {
    // Arrange
    const reload = vi.fn()
    fakeNetwork({ [UPDATE]: failure(500) })
    renderScreen(<PersonIdentityView />, identityTab(reload))
    await renameToBob()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText(/PUT \/api\/profiles\/person-1 · 500/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nom')).toHaveValue('Bob')
    expect(reload).not.toHaveBeenCalled()
  })

  it('onDelete_ShouldDeleteAndGoBackToTheList_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({ [DELETE]: ok() })
    const { router } = renderScreen(<PersonIdentityView />, identityTab(vi.fn()))
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer cette personne' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
    )

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/settings/detection/personnes'),
    )
    expect(network.sent).toContainEqual(expect.objectContaining({ route: DELETE }))
  })
})
