import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { SecondaryButton } from './secondary_button'

describe('SecondaryButton', () => {
  it('SecondaryButton_ShouldShowTheIconThatNamesIt_WhenRendered', () => {
    // Arrange & Act
    render(<SecondaryButton icon={RefreshCw}>Vérifier</SecondaryButton>)

    // Assert
    const button = screen.getByRole('button', { name: 'Vérifier' })
    expect(button).toHaveAttribute('data-variant', 'secondary')
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  it('SecondaryButton_ShouldDrawFilled_WhenItsToggleIsOn', () => {
    // Arrange & Act
    render(
      <SecondaryButton icon={RefreshCw} active>
        Réactiver
      </SecondaryButton>,
    )

    // Assert
    expect(screen.getByRole('button', { name: 'Réactiver' })).toHaveAttribute(
      'data-variant',
      'default',
    )
  })

  it('SecondaryButton_ShouldLeadToItsPageWithItsIcon_WhenGivenADestination', () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <SecondaryButton icon={RefreshCw} to="/detections">
          Toutes les détections
        </SecondaryButton>
      </MemoryRouter>,
    )

    // Assert
    const link = screen.getByRole('link', { name: 'Toutes les détections' })
    expect(link).toHaveAttribute('href', '/detections')
    expect(link.querySelector('svg')).toBeInTheDocument()
  })
})
