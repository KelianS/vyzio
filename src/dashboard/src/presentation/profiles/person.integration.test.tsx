import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeProfile } from '../../testing/profile_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { PersonView } from './person.component'

const PEOPLE = 'GET /api/profiles'

function personAt(profileId: string) {
  return {
    path: '/settings/detection/personnes/:profileId',
    url: `/settings/detection/personnes/${profileId}`,
  }
}

describe('PersonView', () => {
  it('onLoad_ShouldNameThePersonAndOfferTheirTabs_WhenTheyExist', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: ok([makeProfile({ category: 'staff' })]) })

    // Act
    renderScreen(<PersonView />, personAt('person-1'))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByText('Intervenant')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Photos' })).toHaveAttribute(
      'href',
      '/settings/detection/personnes/person-1/photos',
    )
  })

  it('onLoad_ShouldSayThePersonIsMissing_WhenNoneHasThatId', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: ok([makeProfile()]) })

    // Act
    renderScreen(<PersonView />, personAt('person-9'))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Personne introuvable' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revenir à la liste' })).toBeInTheDocument()
  })

  it('onLoad_ShouldSayWhyAndForSupportRatherThanMissing_WhenThePeopleCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: failure(500) })

    // Act
    renderScreen(<PersonView />, personAt('person-1'))

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('GET /api/profiles · 500')
    expect(screen.queryByText('Personne introuvable')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldOfferTheWayBack_WhenThePeopleCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [PEOPLE]: failure(500) })

    // Act
    renderScreen(<PersonView />, personAt('person-1'))

    // Assert
    expect(await screen.findByRole('link', { name: 'Revenir à la liste' })).toBeInTheDocument()
  })

  it('onLoad_ShouldNameThePerson_WhenTheRetryReadsThePeople', async () => {
    // Arrange
    const network = fakeNetwork({ [PEOPLE]: failure(500) })
    renderScreen(<PersonView />, personAt('person-1'))
    await screen.findByRole('alert')
    network.answer(PEOPLE, ok([makeProfile()]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Alice' })).toBeInTheDocument()
  })
})
