import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderScreen } from '../../testing/render_screen'
import { SettingsView } from './settings.component'

describe('SettingsView', () => {
  it('SettingsView_ShouldListEveryRubricAndAskForOne_WhenOpenedAtTheRoot', () => {
    // Arrange & Act
    renderScreen(<SettingsView />, { path: '/settings/*', url: '/settings' })

    // Assert
    const rubrics = screen.getByRole('navigation', { name: 'Rubriques de réglages' })
    expect(within(rubrics).getAllByRole('link')).toHaveLength(7)
    expect(screen.getByText('Choisissez une rubrique.')).toBeInTheDocument()
  })

  it('SettingsView_ShouldNameTheRubricAndLeadBack_WhenARubricIsOpen', () => {
    // Arrange & Act
    renderScreen(<SettingsView />, { path: '/settings/*', url: '/settings/conservation' })

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Conservation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Durée des enregistrements/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveAttribute('href', '/settings')
  })
})
