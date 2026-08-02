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
 * Ces tests portent sur la decision d'ADR-41 : modifier n'a aucun effet, et le
 * brouillon doit dire **ce qui** a change.
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

    // Ce qui s'applique a l'ecran a change ; ce qui est enregistre, non.
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

    // Sans cela, la barre annoncerait une modification qui n'existe plus.
    expect(result.current.dirty).toBe(false)
    expect(result.current.changes).toEqual([])
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

    // Le champ modifie garde la saisie en cours, les autres suivent le serveur :
    // c'est ce qu'un recouvrement donne et qu'une copie perdrait.
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
