import { describe, expect, it } from 'vitest'
import { describePendingRestart, sortScopes } from './pendingRestart'

// The wait must say what waits: a bare count is the opaque state principle #4 forbids (ADR-44).
describe('Ce qui attend le redémarrage', () => {
  it('pending_When nothing waits_Should say nothing at all', () => {
    expect(describePendingRestart([])).toBe('')
  })

  it('pending_When one subject waits_Should name it in the singular', () => {
    expect(describePendingRestart(['detection'])).toBe('Détection attend le redémarrage.')
  })

  it('pending_When several subjects wait_Should list them all', () => {
    expect(describePendingRestart(['retention', 'detection'])).toBe(
      'Détection et Conservation attendent le redémarrage.',
    )
  })

  it('pending_When three subjects wait_Should separate them readably', () => {
    expect(describePendingRestart(['retention', 'cameras', 'detection'])).toBe(
      'Caméras, Détection et Conservation attendent le redémarrage.',
    )
  })

  it('pending_When the server reorders them_Should keep a stable order', () => {
    // Two successive polls must not reshuffle the list.
    expect(sortScopes(['retention', 'cameras'])).toEqual(['cameras', 'retention'])
    expect(sortScopes(['cameras', 'retention'])).toEqual(['cameras', 'retention'])
  })
})
