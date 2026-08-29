import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelpPanel } from './HelpPanel'

/**
 * Ces tests portent sur la decision d'ADR-53 : le troisieme niveau d'aide est **repli par defaut**,
 * et il ne s'ouvre de lui-meme que la ou la tache n'est pas encore faite.
 */
describe('Panneau « En savoir plus » — troisieme niveau d’aide', () => {
  it('panel_When nothing says otherwise_Should stay folded', () => {
    render(
      <HelpPanel title="Où trouver ces informations ?">
        <p>Écrivez à BotFather.</p>
      </HelpPanel>,
    )

    // L'ecran nominal reste aussi dense sans le panneau : c'est la condition
    // pour qu'une aide longue ait le droit d'exister dans la page.
    expect(screen.getByText('Où trouver ces informations ?')).toBeVisible()
    expect(screen.getByText('Écrivez à BotFather.')).not.toBeVisible()
  })

  it('panel_When the task it explains is not done_Should open by itself', () => {
    render(
      <HelpPanel title="Où trouver ces informations ?" defaultOpen>
        <p>Écrivez à BotFather.</p>
      </HelpPanel>,
    )

    expect(screen.getByText('Écrivez à BotFather.')).toBeVisible()
  })
})
