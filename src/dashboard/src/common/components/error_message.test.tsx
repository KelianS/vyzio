import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppErrorKind } from '../errors/app_error'
import { ErrorMessage } from './error_message'

describe('ErrorMessage', () => {
  it('ErrorMessage_ShouldShowTheSentenceAndTheDiagnosticLine_WhenTheErrorCarriesOne', () => {
    render(
      <ErrorMessage
        error={{ kind: AppErrorKind.Server, status: 500, diagnostic: 'GET /api/hub · 500' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Vyzio a rencontré une erreur, réessayez dans un instant',
    )
    expect(screen.getByText('GET /api/hub · 500')).toBeInTheDocument()
  })

  it('ErrorMessage_ShouldShowTheSentenceAlone_WhenTheErrorCarriesNoDiagnostic', () => {
    render(<ErrorMessage error={{ kind: AppErrorKind.NotFound }} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Élément introuvable : il a peut-être été supprimé',
    )
    expect(screen.getByRole('alert').querySelectorAll('p')).toHaveLength(1)
  })
})
