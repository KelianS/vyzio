import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSettingsDraft } from './useSettingsDraft'

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
describe('Brouillon de page', () => {
  it('draft_When nothing was touched_Should be clean', () => {
    const { result } = setup()
    expect(result.current.dirty).toBe(false)
    expect(result.current.changes).toEqual([])
  })

  it('draft_When a value is edited_Should show it without touching what was saved', () => {
    const { result } = setup()

    act(() => result.current.set('motionDays', 30))

    // What the screen applies has changed; what is saved has not.
    expect(result.current.values.motionDays).toBe(30)
    expect(result.current.saved.motionDays).toBe(7)
    expect(result.current.dirty).toBe(true)
  })

  it('draft_When several values are edited_Should name each of them', () => {
    const { result } = setup()

    act(() => result.current.set('motionDays', 30))
    act(() => result.current.set('continuousDays', 2))

    expect(result.current.changes.map((change) => change.label)).toEqual([
      'Séquences de mouvement',
      'Vidéo complète',
    ])
  })

  it('draft_When an edit returns to the saved value_Should stop counting as a change', () => {
    const { result } = setup()

    act(() => result.current.set('motionDays', 30))
    act(() => result.current.set('motionDays', 7))

    // Without that, the bar would announce a change that no longer exists.
    expect(result.current.dirty).toBe(false)
    expect(result.current.changes).toEqual([])
  })

  it('draft_When two keys carry the same setting_Should count it once', () => {
    const { result } = renderHook(() =>
      useSettingsDraft<{ level: string; pinned: boolean }>({
        saved: { level: 'medium', pinned: false },
        labels: { level: 'Sensibilité', pinned: 'Sensibilité' },
      }),
    )

    act(() => {
      result.current.set('level', 'low')
      result.current.set('pinned', true)
    })

    // The user changed one setting only: announcing two would make them doubt
    // what they just did.
    expect(result.current.changes).toEqual([{ key: 'level', label: 'Sensibilité' }])
  })

  it('draft_When discarded_Should return the page to its last saved state', () => {
    const { result } = setup()

    act(() => result.current.set('motionDays', 30))
    act(() => result.current.discard())

    expect(result.current.values.motionDays).toBe(7)
    expect(result.current.dirty).toBe(false)
  })

  it('draft_When saved values arrive from the server_Should follow them for untouched fields', () => {
    const { result, rerender } = setup()

    act(() => result.current.set('motionDays', 30))
    rerender({ current: { continuousDays: 3, motionDays: 7 } })

    // The edited field keeps what is being typed, the others follow the server:
    // that is what an overlay gives and a copy would lose.
    expect(result.current.values.motionDays).toBe(30)
    expect(result.current.values.continuousDays).toBe(3)
  })

  it('draft_When accepted after a save_Should be clean again', () => {
    const { result, rerender } = setup()

    act(() => result.current.set('motionDays', 30))
    act(() => result.current.accept())
    rerender({ current: { continuousDays: 0, motionDays: 30 } })

    expect(result.current.dirty).toBe(false)
    expect(result.current.values.motionDays).toBe(30)
  })
})
