import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { TechnicalInterface } from './technical_interface'

const ADDRESS = 'http://localhost:5000'

describe('TechnicalInterface', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TechnicalInterface_ShouldShowAWait_WhenTheInterfaceIsLoading', () => {
    // Arrange & Act
    render(<TechnicalInterface frigateBaseUrl={ADDRESS} />)

    // Assert
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('TechnicalInterface_ShouldSayWhatToCheck_WhenTheInterfaceDoesNotLoadInTime', () => {
    // Arrange
    render(<TechnicalInterface frigateBaseUrl={ADDRESS} />)

    // Act
    act(() => void vi.advanceTimersByTime(10_000))

    // Assert
    expect(screen.getByRole('heading', { name: 'Frigate inaccessible' })).toBeInTheDocument()
    expect(
      screen.getByText('L’interface Frigate n’a pas pu être chargée dans les délais.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir Frigate dans un onglet' })).toBeInTheDocument()
  })

  it('TechnicalInterface_ShouldShowTheInterfaceAndNeverTimeOut_WhenItLoads', () => {
    // Arrange
    render(<TechnicalInterface frigateBaseUrl={ADDRESS} />)

    // Act
    fireEvent.load(screen.getByTitle('Frigate NVR'))
    act(() => void vi.advanceTimersByTime(10_000))

    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Frigate inaccessible' })).not.toBeInTheDocument()
  })
})
