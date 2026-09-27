import { describe, expect, it } from 'vitest'
import { makeProfilePhoto } from '../../testing/profile_fixture'
import { personPhotosReducer } from './person_photos.reducer'
import { buildInitialPersonPhotosUido } from './person_photos.uido'

describe('personPhotosReducer', () => {
  it('personPhotosReducer_ShouldKeepTheGalleryWithoutAFailure_WhenAReloadFails', () => {
    // Arrange
    const state = { ...buildInitialPersonPhotosUido(), photos: [makeProfilePhoto()] }

    // Act
    const next = personPhotosReducer(state, { type: 'RELOAD_FAILED' })

    // Assert
    expect(next.photos).toEqual([makeProfilePhoto()])
    expect(next.error).toBeNull()
    expect(next.loading).toBe(false)
  })

  it('personPhotosReducer_ShouldCloseTheQuestion_WhenTheRemovalFinishes', () => {
    // Arrange
    const state = { ...buildInitialPersonPhotosUido(), confirmRemoveId: 'photo-1', removing: true }

    // Act
    const next = personPhotosReducer(state, { type: 'REMOVE_FINISHED' })

    // Assert
    expect(next.confirmRemoveId).toBeNull()
    expect(next.removing).toBe(false)
  })

  it('personPhotosReducer_ShouldCloseTheQuestion_WhenTheResyncFinishes', () => {
    // Arrange
    const state = { ...buildInitialPersonPhotosUido(), confirmResync: true, resyncing: true }

    // Act
    const next = personPhotosReducer(state, { type: 'RESYNC_FINISHED' })

    // Assert
    expect(next.confirmResync).toBe(false)
    expect(next.resyncing).toBe(false)
  })
})
