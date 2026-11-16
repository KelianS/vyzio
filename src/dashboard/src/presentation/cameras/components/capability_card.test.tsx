import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Video } from 'lucide-react'
import { CapabilityCard } from './capability_card'

describe('CapabilityCard', () => {
  it('CapabilityCard_ShouldStayClosedUnderItsName_WhenTheCapabilityWorks', () => {
    // Arrange & Act
    render(
      <ul>
        <CapabilityCard
          icon={Video}
          title="Flux vidéo"
          mark={{ kind: 'on', label: 'Fonctionne' }}
          actions={<button type="button">Vérifier</button>}
        />
      </ul>,
    )

    // Assert
    expect(screen.getByRole('img', { name: 'Fonctionne' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vérifier' })).not.toBeVisible()
  })

  it('CapabilityCard_ShouldOpenWithItsWord_WhenTheCapabilityHasSomethingToActOn', () => {
    // Arrange & Act
    render(
      <ul>
        <CapabilityCard
          icon={Video}
          title="Coupure matérielle"
          mark={{ kind: 'off', label: 'À confirmer' }}
          actions={<button type="button">Essayer</button>}
        />
      </ul>,
    )

    // Assert
    expect(screen.getByText('À confirmer')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Essayer' })).toBeVisible()
  })

  it('CapabilityCard_ShouldStayOpen_WhenTheCapabilityItShowedToConfirmNowWorks', () => {
    // Arrange
    const card = (kind: 'on' | 'off', label: string) => (
      <ul>
        <CapabilityCard
          icon={Video}
          title="Orientation"
          mark={{ kind, label }}
          actions={<button type="button">Essayer à nouveau</button>}
        />
      </ul>
    )
    const { rerender } = render(card('off', 'À confirmer'))

    // Act
    rerender(card('on', 'Fonctionne'))

    // Assert
    expect(screen.getByRole('button', { name: 'Essayer à nouveau' })).toBeVisible()
  })
})
