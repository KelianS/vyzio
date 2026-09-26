import { describe, expect, it } from 'vitest'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { HttpError } from '../http/http_error'
import { HttpNotificationSettingsRepository } from './notification_settings.repository'

const SETTINGS = '/api/notifications/settings/telegram'
const repository = new HttpNotificationSettingsRepository('')

// Reads where a 400 means "nothing to show here" rather than a failure.
const OPTIONAL_READS = [
  {
    read: 'getChannelConfig',
    route: `GET ${SETTINGS}`,
    call: () => repository.getChannelConfig('telegram'),
  },
  {
    read: 'getPairing',
    route: `GET ${SETTINGS}/pairing`,
    call: () => repository.getPairing('telegram'),
  },
  {
    read: 'startPairing',
    route: `POST ${SETTINGS}/pairing`,
    call: () => repository.startPairing('telegram'),
  },
  {
    read: 'getListening',
    route: `GET ${SETTINGS}/listening`,
    call: () => repository.getListening('telegram'),
  },
]

// Deletions where a 404 means "already gone".
const DELETIONS = [
  {
    deletion: 'deleteChannel',
    route: `DELETE ${SETTINGS}`,
    call: () => repository.deleteChannel('telegram'),
  },
  {
    deletion: 'revokePairing',
    route: `DELETE ${SETTINGS}/pairing`,
    call: () => repository.revokePairing('telegram'),
  },
]

describe('HttpNotificationSettingsRepository', () => {
  it.each(OPTIONAL_READS)(
    'read_ShouldAnswerNothing_WhenTheServerSaysTheChannelHasNone ($read)',
    async ({ route, call }) => {
      // Arrange
      fakeNetwork({ [route]: failure(400) })

      // Act
      const answer = await call()

      // Assert
      expect(answer).toBeNull()
    },
  )

  it.each(OPTIONAL_READS)(
    'read_ShouldFail_WhenTheServerBreaks ($read)',
    async ({ route, call }) => {
      // Arrange
      fakeNetwork({ [route]: failure(500) })

      // Act
      const reading = call()

      // Assert
      await expect(reading).rejects.toBeInstanceOf(HttpError)
    },
  )

  it.each(DELETIONS)(
    'delete_ShouldSayItRemovedSomething_WhenTheServerAccepts ($deletion)',
    async ({ route, call }) => {
      // Arrange
      fakeNetwork({ [route]: ok() })

      // Act
      const removed = await call()

      // Assert
      expect(removed).toBe(true)
    },
  )

  it.each(DELETIONS)(
    'delete_ShouldSayNothingWasRemoved_WhenItWasAlreadyGone ($deletion)',
    async ({ route, call }) => {
      // Arrange
      fakeNetwork({ [route]: failure(404) })

      // Act
      const removed = await call()

      // Assert
      expect(removed).toBe(false)
    },
  )

  it.each(DELETIONS)(
    'delete_ShouldFail_WhenTheServerBreaks ($deletion)',
    async ({ route, call }) => {
      // Arrange
      fakeNetwork({ [route]: failure(500) })

      // Act
      const deleting = call()

      // Assert
      await expect(deleting).rejects.toBeInstanceOf(HttpError)
    },
  )
})
