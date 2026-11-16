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

  it('SettingsView_ShouldNameTheRubricAndMarkItInTheList_WhenARubricIsOpen', () => {
    // Arrange & Act
    renderScreen(<SettingsView />, { path: '/settings/*', url: '/settings/retention' })

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Conservation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conservation' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('SettingsView_ShouldGroupTheRubricsUnderSurveillanceAndSysteme_WhenOpened', () => {
    // Arrange & Act
    renderScreen(<SettingsView />, { path: '/settings/*', url: '/settings' })

    // Assert
    const surveillance = screen.getByRole('region', { name: 'Surveillance' })
    const system = screen.getByRole('region', { name: 'Système' })
    expect(
      within(surveillance)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Caméras', 'Personnes', 'Planification', 'Notifications'])
    expect(
      within(system)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Conservation', 'Accès', 'Matériel'])
  })
})
