import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'
import { Switch } from './switch'
import { cn } from './utils'

/**
 * Verifie que le socle est branche, pas que shadcn/ui fonctionne (ce n'est pas
 * notre code, ADR-42). Ce qui est teste ici est ce que nous avons decide :
 * les primitives consomment bien la couche semantique de tokens, elles exposent
 * les roles ARIA sur lesquels tous les tests d'ecran s'appuieront, et `cn`
 * arbitre les conflits de classes.
 */
describe('Socle de composants', () => {
  it('primitive_When rendered_Should expose an ARIA role and consume theme tokens', () => {
    render(<Button>Enregistrer</Button>)

    const button = screen.getByRole('button', { name: 'Enregistrer' })
    // Les couleurs passent par les tokens semantiques, jamais par une valeur
    // litterale : c'est ce qui garantit le theme sombre par construction.
    expect(button.className).toContain('bg-primary')
    expect(button.className).toContain('text-primary-foreground')
  })

  it('primitive_When given an interactive role_Should be reachable by role', () => {
    render(<Switch aria-label="Enregistrement continu" />)

    expect(screen.getByRole('switch', { name: 'Enregistrement continu' })).toBeInTheDocument()
  })

  it('cn_When two classes target the same aspect_Should keep the last one', () => {
    expect(cn('rounded-sm', 'rounded-lg')).toBe('rounded-lg')
  })

  it('cn_When a conditional class is inactive_Should drop it', () => {
    const invalid = false
    expect(cn('bg-primary', invalid && 'bg-destructive')).toBe('bg-primary')
  })
})
