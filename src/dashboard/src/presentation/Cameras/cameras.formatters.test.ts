import { describe, expect, it } from 'vitest'
import { formatCameraStatusLabel } from './cameras.formatters'

describe('formatCameraStatusLabel', () => {
  it('formatCameraStatusLabel_ShouldWriteItInFrenchWithItsAccents_WhenTheCameraIsOnline', () => {
    expect(formatCameraStatusLabel('online')).toBe('Connectée')
  })

  it('formatCameraStatusLabel_ShouldAskToCheck_WhenTheStatusIsUnknown', () => {
    expect(formatCameraStatusLabel('something_new')).toBe('À vérifier')
  })
})
