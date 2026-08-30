import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelpPanel } from './HelpPanel'

/**
 * These tests cover the ADR-53 decision: the third level of help is **folded by default**,
 * and it only opens by itself where the task is not done yet.
 */
describe('Panneau « En savoir plus » — troisieme niveau d’aide', () => {
  it('panel_When nothing says otherwise_Should stay folded', () => {
    render(
      <HelpPanel title="Où trouver ces informations ?">
        <p>Écrivez à BotFather.</p>
      </HelpPanel>,
    )

    // The nominal screen stays just as dense without the panel: that is the condition
    // for a long help text to be allowed to exist in the page at all.
    expect(screen.getByText('Où trouver ces informations ?')).toBeVisible()
    expect(screen.getByText('Écrivez à BotFather.')).not.toBeVisible()
  })

  it('panel_When the task it explains is not done_Should open by itself', () => {
    render(
      <HelpPanel title="Où trouver ces informations ?" defaultOpen>
        <p>Écrivez à BotFather.</p>
      </HelpPanel>,
    )

    expect(screen.getByText('Écrivez à BotFather.')).toBeVisible()
  })
})
