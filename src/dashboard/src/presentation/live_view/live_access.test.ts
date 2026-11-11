import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import { liveAccessOf } from './live_access'

describe('liveAccessOf', () => {
  it.each([
    { name: 'loading', camera: undefined, loading: true, unread: false, expected: 'loading' },
    { name: 'unread', camera: undefined, loading: false, unread: true, expected: 'unread' },
    { name: 'gone', camera: undefined, loading: false, unread: false, expected: 'removed' },
    {
      name: 'in privacy mode',
      camera: makeCamera({ privacyModeActive: true, connected: false }),
      loading: false,
      unread: false,
      expected: 'privacy',
    },
    {
      name: 'to set up',
      camera: makeCamera({ validationState: 'draft', connected: false }),
      loading: false,
      unread: false,
      expected: 'unwatched',
    },
    {
      name: 'offline',
      camera: makeCamera({ connected: false, status: 'offline' }),
      loading: false,
      unread: false,
      expected: 'offline',
    },
    { name: 'watched', camera: makeCamera(), loading: true, unread: true, expected: 'open' },
  ])(
    'liveAccessOf_ShouldReachTheStateATapWouldReach_WhenTheCameraIs $name',
    ({ camera, loading, unread, expected }) => {
      // Arrange & Act
      const access = liveAccessOf(camera, { loading, unread })

      // Assert
      expect(access).toBe(expected)
    },
  )
})
