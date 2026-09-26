import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import { formatCameraStatusLabel, formatStatusTone } from './cameras.formatters'

describe('formatCameraStatusLabel', () => {
  it('formatCameraStatusLabel_ShouldWriteItInFrenchWithItsAccents_WhenTheCameraIsOnline', () => {
    // Arrange & Act
    const label = formatCameraStatusLabel('online')

    // Assert
    expect(label).toBe('Connectée')
  })

  it('formatCameraStatusLabel_ShouldAskToCheck_WhenTheStatusIsUnknown', () => {
    // Arrange & Act
    const label = formatCameraStatusLabel('something_new')

    // Assert
    expect(label).toBe('À vérifier')
  })

  it.each([
    { status: 'offline', label: 'Hors ligne' },
    { status: 'degraded', label: 'Dégradée' },
    { status: 'config_error', label: 'Erreur de configuration' },
  ])(
    'formatCameraStatusLabel_ShouldNameTheTrouble_WhenTheCameraIsNotOnline ($status)',
    ({ status, label }) => {
      // Arrange & Act
      const said = formatCameraStatusLabel(status)

      // Assert
      expect(said).toBe(label)
    },
  )
})

describe('formatStatusTone', () => {
  it.each([
    { status: 'online', needsAttention: false, tone: 'ok' },
    { status: 'online', needsAttention: true, tone: 'warn' },
    { status: 'offline', needsAttention: false, tone: 'danger' },
    { status: 'degraded', needsAttention: false, tone: 'warn' },
  ])(
    'formatStatusTone_ShouldColourTheBadgeByHowTheCameraIs_WhenItReportsItsStatus ($status, attention: $needsAttention)',
    ({ status, needsAttention, tone }) => {
      // Arrange & Act
      const said = formatStatusTone(makeCamera({ status, needsAttention }))

      // Assert
      expect(said).toBe(tone)
    },
  )
})
