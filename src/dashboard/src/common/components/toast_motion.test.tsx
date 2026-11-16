import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { holdStill, layOut, touchDown, touchMove, touchUp } from '../../testing/finger'
import { withFullMotion } from '../../testing/full_motion'
import { ToastProvider, useToast } from './toast'

function Trigger({ diagnostic }: { diagnostic: string }) {
  const { toast } = useToast()
  return (
    <button
      type="button"
      onClick={() => toast('La caméra a refusé la commande', 'error', diagnostic)}
    >
      go
    </button>
  )
}

// Apart from the toast's other tests: their fake clock would park the frames these springs run on.
function showToast(diagnostic: string) {
  render(
    <ToastProvider>
      <Trigger diagnostic={diagnostic} />
    </ToastProvider>,
  )
  act(() => screen.getByRole('button', { name: 'go' }).click())
}

const MESSAGE = 'La caméra a refusé la commande'

/** The toast once it has risen into place, and the top edge a finger pulls it down by. */
async function risenToast() {
  showToast('GET /api/hub · 500')
  const toast = screen.getByRole('status')
  await waitFor(() => expect(toast.style.transform).toBe(''))
  const edge = toast.querySelector('[data-toast-handle]') as HTMLElement
  return { toast, edge }
}

describe('Toast motion', () => {
  let restoreLayout = () => {}
  beforeEach(() => {
    withFullMotion()
    restoreLayout = layOut(320, 60)
  })
  afterEach(() => restoreLayout())

  it('toast_ShouldStayOnScreenWhileItLeaves_WhenTheUserClosesIt', () => {
    // Arrange
    showToast('GET /api/hub · 500')

    // Act
    act(() => screen.getByRole('button', { name: 'Fermer' }).click())

    // Assert
    expect(screen.getByText(MESSAGE)).toBeInTheDocument()
  })

  it('toast_ShouldLeaveTheScreen_WhenItsLeavingHasPlayed', async () => {
    // Arrange
    showToast('GET /api/hub · 500')

    // Act
    act(() => screen.getByRole('button', { name: 'Fermer' }).click())

    // Assert
    await waitFor(() => expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument())
  })

  it('toast_ShouldComeBackOnce_WhenTheSameFailureIsRaisedWhileItLeaves', () => {
    // Arrange
    showToast('GET /api/hub · 500')
    act(() => screen.getByRole('button', { name: 'Fermer' }).click())

    // Act
    act(() => screen.getByRole('button', { name: 'go' }).click())

    // Assert
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1)
  })

  it('toast_ShouldFollowTheFingerOneToOne_WhenDraggedDown', async () => {
    // Arrange
    const { toast, edge } = await risenToast()

    // Act
    touchDown(edge, 100, 100)
    touchMove(edge, 100, 115)
    touchMove(edge, 100, 140)

    // Assert
    expect(toast.style.transform).toBe('translate3d(0px, 25px, 0px)')
  })

  it('toast_ShouldClose_WhenAFlickCarriesItDownEvenThoughItCarriesADiagnosticLine', async () => {
    // Arrange
    const { edge } = await risenToast()

    // Act
    touchDown(edge, 100, 100)
    touchMove(edge, 100, 115)
    touchMove(edge, 100, 125)
    touchUp(edge, 100, 125)

    // Assert
    await waitFor(() => expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument())
  })

  it('toast_ShouldComeBackToItsPlace_WhenReleasedSlowlyBeforeHalfItsHeight', async () => {
    // Arrange
    const { toast, edge } = await risenToast()
    touchDown(edge, 100, 100)
    touchMove(edge, 100, 115)
    touchMove(edge, 100, 135)
    await holdStill()

    // Act
    touchUp(edge, 100, 135)

    // Assert
    await waitFor(() => expect(toast.style.transform).toBe(''))
    expect(screen.getByText(MESSAGE)).toBeInTheDocument()
  })
})

describe('Toast text under the finger', () => {
  beforeEach(() => withFullMotion())

  it('toast_ShouldStayOpenAndInPlace_WhenADragStartsOnItsDiagnosticLine', async () => {
    // Arrange
    const { toast } = await risenToast()
    const diagnostic = screen.getByText('GET /api/hub · 500')

    // Act
    touchDown(diagnostic, 100, 100)
    touchMove(diagnostic, 100, 115)
    touchMove(diagnostic, 100, 200)
    touchUp(diagnostic, 100, 200)

    // Assert
    expect(toast.style.transform).toBe('')
    expect(screen.getByText(MESSAGE)).toBeInTheDocument()
  })
})

describe('Toast under reduced motion', () => {
  it('toast_ShouldLeaveWithoutMoving_WhenThePhoneAsksForLessMotion', async () => {
    // Arrange
    showToast('GET /api/hub · 500')
    const toast = screen.getByRole('status')

    // Act
    act(() => screen.getByRole('button', { name: 'Fermer' }).click())

    // Assert
    expect(toast.style.transform).toBe('')
    await waitFor(() => expect(toast).not.toBeInTheDocument())
  })
})
