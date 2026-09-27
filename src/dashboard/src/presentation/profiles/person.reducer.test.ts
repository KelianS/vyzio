import { describe, expect, it } from 'vitest'
import { AppErrorKind } from '../../common/errors/app_error'
import { makeProfile } from '../../testing/profile_fixture'
import { personReducer } from './person.reducer'
import { buildInitialPersonUido } from './person.uido'

const people = [makeProfile(), makeProfile({ id: 'person-2', name: 'Bob' })]

describe('personReducer', () => {
  it('personReducer_ShouldPickThePersonOfTheRoute_WhenThePeopleLoad', () => {
    // Arrange
    const state = buildInitialPersonUido()

    // Act
    const next = personReducer(state, { type: 'LOAD_SUCCEEDED', people, profileId: 'person-2' })

    // Assert
    expect(next.person?.name).toBe('Bob')
  })

  it('personReducer_ShouldHaveNoPerson_WhenNoneHasTheRouteId', () => {
    // Arrange
    const state = buildInitialPersonUido()

    // Act
    const next = personReducer(state, { type: 'LOAD_SUCCEEDED', people, profileId: 'person-9' })

    // Assert
    expect(next.person).toBeNull()
  })

  it('personReducer_ShouldForgetThePreviousFailure_WhenARetryStarts', () => {
    // Arrange
    const state = {
      ...buildInitialPersonUido(),
      loading: false,
      error: { kind: AppErrorKind.Server, status: 500 },
    }

    // Act
    const next = personReducer(state, { type: 'LOAD_STARTED' })

    // Assert
    expect(next.error).toBeNull()
    expect(next.loading).toBe(true)
  })
})
