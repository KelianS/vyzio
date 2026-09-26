import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSettingsDraft } from './use_settings_draft'

interface Values {
  continuousDays: number
  motionDays: number
}

const labels = { continuousDays: 'Vidéo complète', motionDays: 'Séquences de mouvement' }

function setup(saved: Values = { continuousDays: 0, motionDays: 7 }) {
  return renderHook(({ current }) => useSettingsDraft<Values>({ saved: current, labels }), {
    initialProps: { current: saved },
  })
}

/**
 * These tests cover the ADR-41 decision: editing has no effect, and the draft
 * must say **what** changed.
 */
describe('useSettingsDraft', () => {
  it('useSettingsDraft_ShouldBeClean_WhenNothingWasTouched', () => {
    // Arrange & Act
    const { result } = setup()

    // Assert
    expect(result.current.dirty).toBe(false)
    expect(result.current.changes).toEqual([])
  })

  it('useSettingsDraft_ShouldShowTheEditAndKeepTheSavedValue_WhenAValueIsEdited', () => {
    // Arrange
    const { result } = setup()

    // Act
    act(() => result.current.set('motionDays', 30))

    // Assert
    // What the screen applies has changed; what is saved has not.
    expect(result.current.values.motionDays).toBe(30)
    expect(result.current.saved.motionDays).toBe(7)
    expect(result.current.dirty).toBe(true)
  })

  it('useSettingsDraft_ShouldNameEachChange_WhenSeveralValuesAreEdited', () => {
    // Arrange
    const { result } = setup()

    // Act
    act(() => result.current.set('motionDays', 30))
    act(() => result.current.set('continuousDays', 2))

    // Assert
    expect(result.current.changes.map((change) => change.label)).toEqual([
      'Séquences de mouvement',
      'Vidéo complète',
    ])
  })

  it('useSettingsDraft_ShouldStopCountingTheChange_WhenAnEditReturnsToTheSavedValue', () => {
    // Arrange
    const { result } = setup()
    act(() => result.current.set('motionDays', 30))

    // Act
    act(() => result.current.set('motionDays', 7))

    // Assert
    // Without that, the bar would announce a change that no longer exists.
    expect(result.current.dirty).toBe(false)
    expect(result.current.changes).toEqual([])
  })

  it('useSettingsDraft_ShouldCountTheSettingOnce_WhenTwoKeysCarryIt', () => {
    // Arrange
    const { result } = renderHook(() =>
      useSettingsDraft<{ level: string; pinned: boolean }>({
        saved: { level: 'medium', pinned: false },
        labels: { level: 'Sensibilité', pinned: 'Sensibilité' },
      }),
    )

    // Act
    act(() => {
      result.current.set('level', 'low')
      result.current.set('pinned', true)
    })

    // Assert
    // The user changed one setting only: announcing two would make them doubt
    // what they just did.
    expect(result.current.changes).toEqual([{ key: 'level', label: 'Sensibilité' }])
  })

  it('useSettingsDraft_ShouldReturnToTheSavedState_WhenDiscarded', () => {
    // Arrange
    const { result } = setup()
    act(() => result.current.set('motionDays', 30))

    // Act
    act(() => result.current.discard())

    // Assert
    expect(result.current.values.motionDays).toBe(7)
    expect(result.current.dirty).toBe(false)
  })

  it('useSettingsDraft_ShouldFollowTheServerForUntouchedFields_WhenSavedValuesArrive', () => {
    // Arrange
    const { result, rerender } = setup()
    act(() => result.current.set('motionDays', 30))

    // Act
    rerender({ current: { continuousDays: 3, motionDays: 7 } })

    // Assert
    // The edited field keeps what is being typed, the others follow the server:
    // that is what an overlay gives and a copy would lose.
    expect(result.current.values.motionDays).toBe(30)
    expect(result.current.values.continuousDays).toBe(3)
  })

  it('useSettingsDraft_ShouldBeCleanAgain_WhenAcceptedAfterASave', () => {
    // Arrange
    const { result, rerender } = setup()
    act(() => result.current.set('motionDays', 30))

    // Act
    act(() => result.current.accept())
    rerender({ current: { continuousDays: 0, motionDays: 30 } })

    // Assert
    expect(result.current.dirty).toBe(false)
    expect(result.current.values.motionDays).toBe(30)
  })
})
