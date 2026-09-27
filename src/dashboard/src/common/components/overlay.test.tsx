import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmModal } from './confirm_modal'
import { Overlay } from './overlay'
import { ToastProvider, useToast } from './toast'

function ToastTrigger() {
  const { toast } = useToast()
  return (
    <button type="button" onClick={() => toast('La caméra a refusé la commande', 'error', 'diag')}>
      go
    </button>
  )
}

describe('Overlay', () => {
  it('Overlay_ShouldBeADialogNamedByItsLabel_WhenItOpens', () => {
    // Arrange & Act
    render(
      <Overlay label="Aperçu" onClose={vi.fn()}>
        <p>contenu</p>
      </Overlay>,
    )

    // Assert
    expect(screen.getByRole('dialog', { name: 'Aperçu' })).toHaveTextContent('contenu')
  })

  it('onClose_ShouldBeCalledOnce_WhenTheCrossIsClicked', async () => {
    // Arrange
    const onClose = vi.fn()
    render(
      <Overlay label="Aperçu" onClose={onClose}>
        <p>contenu</p>
      </Overlay>,
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('onClose_ShouldBeCalled_WhenTheBackdropIsClicked', async () => {
    // Arrange
    const onClose = vi.fn()
    render(
      <Overlay label="Aperçu" onClose={onClose}>
        <p>contenu</p>
      </Overlay>,
    )

    // Act
    await userEvent.click(screen.getByRole('dialog', { name: 'Aperçu' }))

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('onClose_ShouldNotBeCalled_WhenTheContentIsClicked', async () => {
    // Arrange
    const onClose = vi.fn()
    render(
      <Overlay label="Aperçu" onClose={onClose}>
        <p>contenu</p>
      </Overlay>,
    )

    // Act
    await userEvent.click(screen.getByText('contenu'))

    // Assert
    expect(onClose).not.toHaveBeenCalled()
  })

  it('onClose_ShouldBeCalled_WhenEscapeIsPressed', async () => {
    // Arrange
    const onClose = vi.fn()
    render(
      <Overlay label="Aperçu" onClose={onClose}>
        <p>contenu</p>
      </Overlay>,
    )

    // Act
    await userEvent.keyboard('{Escape}')

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('onClose_ShouldNotBeCalled_WhenEscapeClosesAQuestionOpenedFromInside', async () => {
    // Arrange
    const onClose = vi.fn()
    const onCancel = vi.fn()
    render(
      <Overlay label="Aperçu" onClose={onClose}>
        <ConfirmModal
          title="Redéfinir cette position ?"
          body="corps"
          confirmLabel="Redéfinir"
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      </Overlay>,
    )

    // Act
    await userEvent.keyboard('{Escape}')

    // Assert
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('onClose_ShouldNotBeCalled_WhenAQuestionOpenedFromInsideIsConfirmed', async () => {
    // Arrange
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(
      <Overlay label="Aperçu" onClose={onClose}>
        <ConfirmModal
          title="Redéfinir cette position ?"
          body="corps"
          confirmLabel="Redéfinir"
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      </Overlay>,
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Redéfinir' }))

    // Assert
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('onClose_ShouldNotBeCalled_WhenAToastIsDismissed', async () => {
    // Arrange
    const onClose = vi.fn()
    // jsdom reads no Tailwind: the toast's `pointer-events-auto` under the modal is invisible to it.
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(
      <ToastProvider>
        <Overlay label="Aperçu" onClose={onClose}>
          <ToastTrigger />
        </Overlay>
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'go' }))

    // Act
    const toasts = screen.getByRole('region', { name: 'Notifications', hidden: true })
    await user.click(within(toasts).getByRole('button', { name: 'Fermer', hidden: true }))

    // Assert
    expect(screen.queryByText('La caméra a refusé la commande')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
