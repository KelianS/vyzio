import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'
import { Switch } from './switch'
import { cn } from './utils'

/**
 * Checks that the foundation is wired, not that shadcn/ui works (that is not our
 * code, ADR-42). What is tested here is what we decided: the primitives really do
 * consume the semantic token layer, they expose the ARIA roles every screen test
 * will lean on, and `cn` arbitrates class conflicts.
 */
describe('UI foundation', () => {
  it('Button_ShouldUseTheThemeTokens_WhenRendered', () => {
    render(<Button>Enregistrer</Button>)

    const button = screen.getByRole('button', { name: 'Enregistrer' })
    // Colours go through the semantic tokens, never through a literal value:
    // that is what guarantees the dark theme by construction.
    expect(button.className).toContain('bg-primary')
    expect(button.className).toContain('text-primary-foreground')
  })

  it('Switch_ShouldBeReachableByRole_WhenGivenALabel', () => {
    render(<Switch aria-label="Enregistrement continu" />)

    expect(screen.getByRole('switch', { name: 'Enregistrement continu' })).toBeInTheDocument()
  })

  it('cn_ShouldKeepTheLastClass_WhenTwoTargetTheSameAspect', () => {
    expect(cn('rounded-sm', 'rounded-lg')).toBe('rounded-lg')
  })

  it('cn_ShouldDropTheClass_WhenItsConditionIsFalse', () => {
    const invalid = false
    expect(cn('bg-primary', invalid && 'bg-destructive')).toBe('bg-primary')
  })
})
