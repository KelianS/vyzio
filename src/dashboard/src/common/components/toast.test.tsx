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

/** jsdom plays no animation: the toast's fade is stood in for by one that ends with `finished`. */
function playFadesUntil(finished: Promise<unknown>) {
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: () => [{ finished }],
  })
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(Element.prototype, 'getAnimations')
  })

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

  it('toast_ShouldCloseByItself_WhenItCarriesNoDiagnosticLine', () => {
    // Arrange
    showToast('error')

    // Act
    act(() => vi.advanceTimersByTime(4_000))

    // Assert
    expect(screen.queryByText('La caméra a refusé la commande')).not.toBeInTheDocument()
  })

  it('toast_ShouldStayOnScreenWhileItFadesOut_WhenTheUserClosesIt', () => {
    // Arrange
    playFadesUntil(new Promise(() => undefined))
    showToast('error', 'GET /api/hub · 500')

    // Act
    act(() => screen.getByRole('button', { name: 'Fermer' }).click())

    // Assert
    expect(screen.getByText('La caméra a refusé la commande')).toBeInTheDocument()
  })

  it('toast_ShouldLeaveTheScreen_WhenItsFadeOutHasPlayed', async () => {
    // Arrange
    let endFade = () => {}
    playFadesUntil(new Promise<void>((resolve) => (endFade = resolve)))
    showToast('error', 'GET /api/hub · 500')
    act(() => screen.getByRole('button', { name: 'Fermer' }).click())

    // Act
    await act(async () => endFade())

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
