import { describe, expect, it } from 'vitest'
import { formatCameraStatusLabel } from './cameras.formatters'

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
})
