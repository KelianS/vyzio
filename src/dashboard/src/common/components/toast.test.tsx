import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { ToastProvider, useToast } from './toast'
import type { ToastTone } from './toast'

function Trigger({ tone, diagnostic }: { tone: ToastTone; diagnostic?: string }) {
  const { toast } = useToast()
  return (
    <button type="button" onClick={() => toast('La caméra a refusé la commande', tone, diagnostic)}>
      go
    </button>
  )
}

function showToast(tone: ToastTone, diagnostic?: string) {
  render(
    <ToastProvider>
      <Trigger tone={tone} diagnostic={diagnostic} />
    </ToastProvider>,
  )
  act(() => screen.getByRole('button', { name: 'go' }).click())
}

function showToastWithRetry(onRetry: () => void) {
  function RetryTrigger() {
    const { toast } = useToast()
    return (
      <button
        type="button"
        onClick={() =>
          toast('Salon : la caméra ne s’est pas tournée.', 'error', undefined, {
            label: 'Réessayer',
            onClick: onRetry,
          })
        }
      >
        go
      </button>
    )
  }
  render(
    <ToastProvider>
      <RetryTrigger />
    </ToastProvider>,
  )
  act(() => screen.getByRole('button', { name: 'go' }).click())
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('toast_ShouldShowTheDiagnosticLineUnderTheSentence_WhenAnErrorCarriesOne', () => {
    // Arrange & Act
    showToast('error', 'POST /api/cameras/c/ptz/move · 502 Bad Gateway · camera_refused')

    // Assert
    expect(screen.getByText('La caméra a refusé la commande')).toBeInTheDocument()
    expect(
      screen.getByText('POST /api/cameras/c/ptz/move · 502 Bad Gateway · camera_refused'),
    ).toBeInTheDocument()
  })

  it('toast_ShouldStayUntilDismissed_WhenItCarriesADiagnosticLine', () => {
    // Arrange
    showToast('error', 'GET /api/hub · 500')

    // Act
    act(() => vi.advanceTimersByTime(60_000))

    // Assert
    expect(screen.getByText('La caméra a refusé la commande')).toBeInTheDocument()
  })

  it('toast_ShouldStayUntilDismissed_WhenItOffersToRetry', () => {
    // Arrange
    showToastWithRetry(vi.fn())

    // Act
    act(() => vi.advanceTimersByTime(60_000))

    // Assert
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('toast_ShouldDoTheActAgain_WhenTheUserTapsRetry', () => {
    // Arrange
    const onRetry = vi.fn()
    showToastWithRetry(onRetry)

    // Act
    act(() => screen.getByRole('button', { name: 'Réessayer' }).click())

    // Assert
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('toast_ShouldCloseByItself_WhenItCarriesNoDiagnosticLine', async () => {
    // Arrange
    showToast('error')

    // Act
    act(() => vi.advanceTimersByTime(4_000))
    // Its leaving lands on the next frames.
    await act(() => vi.advanceTimersByTimeAsync(100))

    // Assert
    expect(screen.queryByText('La caméra a refusé la commande')).not.toBeInTheDocument()
  })

  it('toast_ShouldShowItOnce_WhenTheSameFailureIsRaisedTwice', () => {
    // Arrange
    showToast('error', 'GET /api/hub · 500')

    // Act
    act(() => screen.getByRole('button', { name: 'go' }).click())

    // Assert
    expect(screen.getAllByText('La caméra a refusé la commande')).toHaveLength(1)
  })
})
