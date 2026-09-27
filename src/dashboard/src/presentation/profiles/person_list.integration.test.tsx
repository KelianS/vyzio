import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    expect(person).toHaveTextContent('Famille · Ne pas me notifier')
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

  it('onLoad_ShouldSayWhyAndForSupport_WhenTheListCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: failure(500) })

    // Act
    renderScreen(<PersonListView />, LIST)

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('GET /api/profiles · 500')
    expect(screen.queryByText('Personne d’enregistrée pour l’instant.')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldStillOfferToAddSomeone_WhenTheListCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: failure(500) })

    // Act
    renderScreen(<PersonListView />, LIST)

    // Assert
    await screen.findByRole('alert')
    expect(screen.getByRole('link', { name: 'Ajouter une personne' })).toBeInTheDocument()
  })

  it('onLoad_ShouldListThePeople_WhenTheRetryReadsTheList', async () => {
    // Arrange
    const network = fakeNetwork({ [PEOPLE]: failure(500) })
    renderScreen(<PersonListView />, LIST)
    await screen.findByRole('alert')
    network.answer(PEOPLE, ok([makeProfile()]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('link', { name: /Alice/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
