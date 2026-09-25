import { describe, expect, it } from 'vitest'
import { formatCameraStatusLabel, formatStatusTone } from './cameras.formatters'
import type { Camera } from '../../domain/entities/Camera'

const camera = (overrides: Partial<Camera>) =>
  ({ status: 'online', needsAttention: false, accountRefusedAt: null, ...overrides }) as Camera

describe('cameras.formatters', () => {
  const refused = camera({ status: 'offline', accountRefusedAt: '2026-09-25T10:00:00Z' })

  it('formatCameraStatusLabel_ShouldNameTheRefusedPassword_WhenTheCameraRefusedItsAccount', () => {
    expect(formatCameraStatusLabel(refused)).toBe('Mot de passe refusé')
  })

  it('formatStatusTone_ShouldBeDanger_WhenTheCameraRefusedItsAccount', () => {
    expect(formatStatusTone(refused)).toBe('danger')
  })

  it('formatCameraStatusLabel_ShouldSayOffline_WhenTheCameraIsAwayWithoutARefusal', () => {
    expect(formatCameraStatusLabel(camera({ status: 'offline' }))).toBe('Hors ligne')
  })
})
