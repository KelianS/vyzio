import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeProfile } from '../../testing/profile_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { AddPersonView } from './add_person.component'

const CREATE = 'POST /api/profiles'
const ADD = {
  path: '/settings/detection/personnes/ajout',
  url: '/settings/detection/personnes/ajout',
}

async function typeTheName(name: string) {
  await userEvent.type(await screen.findByLabelText('Nom'), name)
}

describe('AddPersonView', () => {
  it('onCreate_ShouldAddThePersonAndOpenTheirPhotos_WhenTheUserNamesThem', async () => {
    // Arrange
    const network = fakeNetwork({ [CREATE]: ok(makeProfile()) })
    const { router } = renderScreen(<AddPersonView />, ADD)
    await typeTheName('  Alice ')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/settings/detection/personnes/person-1/photos'),
    )
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: CREATE,
        body: { name: 'Alice', category: 'family', alertMode: 'always' },
      }),
    )
  })

  it('onCreate_ShouldStayAndSayWhy_WhenTheAddFails', async () => {
    // Arrange
    fakeNetwork({ [CREATE]: failure(500) })
    const { router } = renderScreen(<AddPersonView />, ADD)
    await typeTheName('Alice')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/POST \/api\/profiles · 500/)).toBeVisible()
    expect(router.state.location.pathname).toBe('/settings/detection/personnes/ajout')
  })

  it('onNameChange_ShouldKeepAddingOff_WhenTheNameIsBlank', async () => {
    // Arrange
    fakeNetwork({})
    renderScreen(<AddPersonView />, ADD)

    // Act
    await typeTheName('   ')

    // Assert
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled()
  })
})
