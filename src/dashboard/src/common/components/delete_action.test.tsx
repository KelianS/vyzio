import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeleteAction } from './delete_action'

function renderDeleteAction(confirming: boolean) {
  render(
    <DeleteAction
      label="Supprimer cette caméra"
      question="Supprimer « Jardin » ?"
      consequence="Vyzio cesse de surveiller cette caméra."
      confirming={confirming}
      deleting={false}
      onAsk={vi.fn()}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  )
}

describe('DeleteAction', () => {
  it('DeleteAction_ShouldReadQuietOnThePage_WhenNothingIsAskedYet', () => {
    // Arrange & Act
    renderDeleteAction(false)

    // Assert
    expect(screen.getByRole('button', { name: 'Supprimer cette caméra' })).toHaveAttribute(
      'data-variant',
      'destructive-outline',
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('DeleteAction_ShouldConfirmWithTheSolidRedButton_WhenTheRemovalIsAsked', async () => {
    // Arrange & Act
    renderDeleteAction(true)

    // Assert
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Vyzio cesse de surveiller cette caméra.')
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveAttribute(
      'data-variant',
      'destructive',
    )
  })
})
