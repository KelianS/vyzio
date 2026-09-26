import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppErrorKind } from '../errors/app_error'
import { ErrorMessage } from './error_message'

describe('ErrorMessage', () => {
  it('ErrorMessage_ShouldShowTheSentenceAndTheDiagnosticLine_WhenTheErrorCarriesOne', () => {
    // Arrange & Act
    render(
      <ErrorMessage
        error={{ kind: AppErrorKind.Server, status: 500, diagnostic: 'GET /api/hub · 500' }}
      />,
    )

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Vyzio a rencontré une erreur, réessayez dans un instant',
    )
    expect(screen.getByText('GET /api/hub · 500')).toBeInTheDocument()
  })

  it('ErrorMessage_ShouldShowTheSentenceAlone_WhenTheErrorCarriesNoDiagnostic', () => {
    // Arrange & Act
    render(<ErrorMessage error={{ kind: AppErrorKind.NotFound }} />)

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Élément introuvable : il a peut-être été supprimé',
    )
    expect(screen.getByRole('alert').querySelectorAll('p')).toHaveLength(1)
  })
})
