import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { makeProfile } from '../../testing/profile_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { PersonListView } from './person_list.component'

const PEOPLE = 'GET /api/profiles'
const LIST = { path: '/settings/detection/personnes', url: '/settings/detection/personnes' }

describe('PersonListView', () => {
  it('onLoad_ShouldListEachPersonWithWhatVyzioDoes_WhenSomeAreKnown', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: ok([makeProfile({ alertMode: 'never' })]) })

    // Act
    renderScreen(<PersonListView />, LIST)

    // Assert
    const person = await screen.findByRole('link', { name: /Alice/ })
    expect(person).toHaveTextContent('Famille · Ne rien signaler')
    expect(person).toHaveAttribute('href', '/settings/detection/personnes/person-1')
  })

  it('onLoad_ShouldSayNobodyIsKnown_WhenTheListIsEmpty', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: ok([]) })

    // Act
    renderScreen(<PersonListView />, LIST)

    // Assert
    expect(await screen.findByText('Personne d’enregistrée pour l’instant.')).toBeInTheDocument()
  })

  it('onLoad_ShouldStillOfferToAddSomeone_WhenTheListCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: failure(500) })

    // Act
    renderScreen(<PersonListView />, LIST)

    // Assert
    expect(await screen.findByText('Personne d’enregistrée pour l’instant.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ajouter une personne' })).toBeInTheDocument()
  })
})
