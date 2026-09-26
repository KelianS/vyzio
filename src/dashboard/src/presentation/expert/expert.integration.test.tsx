import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderScreen } from '../../testing/render_screen'
import { ExpertView } from './expert.component'

describe('ExpertView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ExpertView_ShouldShowAWait_WhenTheInterfaceIsLoading', () => {
    // Arrange & Act
    renderScreen(<ExpertView />)

    // Assert
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('ExpertView_ShouldSayWhatToCheck_WhenTheInterfaceDoesNotLoadInTime', () => {
    // Arrange
    renderScreen(<ExpertView />)

    // Act
    act(() => void vi.advanceTimersByTime(10_000))

    // Assert
    expect(screen.getByRole('heading', { name: 'Frigate inaccessible' })).toBeInTheDocument()
    expect(
      screen.getByText('L’interface Frigate n’a pas pu être chargée dans les délais.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir Frigate dans un onglet' })).toBeInTheDocument()
  })

  it('ExpertView_ShouldShowTheInterfaceAndNeverTimeOut_WhenItLoads', () => {
    // Arrange
    renderScreen(<ExpertView />)

    // Act
    fireEvent.load(screen.getByTitle('Frigate NVR'))
    act(() => void vi.advanceTimersByTime(10_000))

    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Frigate inaccessible' })).not.toBeInTheDocument()
  })
})
