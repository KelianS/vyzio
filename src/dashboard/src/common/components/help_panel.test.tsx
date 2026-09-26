import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelpPanel } from './help_panel'

/**
 * These tests cover the ADR-53 decision: the third level of help is **folded by default**,
 * and it only opens by itself where the task is not done yet.
 */
describe('HelpPanel', () => {
  it('HelpPanel_ShouldStayFolded_WhenNothingSaysOtherwise', () => {
    // Arrange & Act
    render(
      <HelpPanel title="Où trouver ces informations ?">
        <p>Écrivez à BotFather.</p>
      </HelpPanel>,
    )

    // Assert
    // The nominal screen stays just as dense without the panel: that is the condition
    // for a long help text to be allowed to exist in the page at all.
    expect(screen.getByText('Où trouver ces informations ?')).toBeVisible()
    expect(screen.getByText('Écrivez à BotFather.')).not.toBeVisible()
  })

  it('HelpPanel_ShouldOpenByItself_WhenTheTaskItExplainsIsNotDone', () => {
    // Arrange & Act
    render(
      <HelpPanel title="Où trouver ces informations ?" defaultOpen>
        <p>Écrivez à BotFather.</p>
      </HelpPanel>,
    )

    // Assert
    expect(screen.getByText('Écrivez à BotFather.')).toBeVisible()
  })
})
