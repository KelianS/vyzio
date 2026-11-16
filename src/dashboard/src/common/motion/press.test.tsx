import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { withFullMotion } from '../../testing/full_motion'
import { installPressFeedback } from './press'

let uninstall = () => {}
afterEach(() => uninstall())

function aControl() {
  uninstall = installPressFeedback(document)
  render(
    <button type="button" data-slot="pressable-control">
      Retour
    </button>,
  )
  return screen.getByRole('button', { name: 'Retour' })
}

describe('installPressFeedback', () => {
  it('Control_ShouldSinkThenSpringBack_WhenPressedThenReleased', async () => {
    // Arrange
    withFullMotion()
    const control = aControl()

    // Act
    fireEvent.pointerDown(control, { button: 0 })
    await waitFor(() => expect(control.style.scale).toBe('0.96'))
    fireEvent.pointerUp(control, { button: 0 })

    // Assert
    await waitFor(() => expect(control.style.scale).toBe(''))
  })

  it('Control_ShouldLeaveItsDimToTheStylesheet_WhenThePhoneAsksForLessMotion', async () => {
    // Arrange
    const control = aControl()

    // Act
    fireEvent.pointerDown(control, { button: 0 })
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Assert
    expect(control.style.scale).toBe('')
  })
})
