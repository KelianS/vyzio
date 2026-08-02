import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingRow } from './SettingRow'
import type { SettingDeclaration, SettingOption } from './settingDeclaration'

function options(count: number): SettingOption[] {
  return Array.from({ length: count }, (_, index) => ({
    value: `v${index}`,
    label: `Option ${index}`,
  }))
}

function declare(overrides: Partial<SettingDeclaration>): SettingDeclaration {
  return {
    id: 'reglage',
    label: 'Un réglage',
    nature: { kind: 'toggle' },
    value: false,
    onChange: vi.fn(),
    ...overrides,
  }
}

/**
 * Ces tests portent sur la **decision** d'ADR-43, pas sur le rendu : la nature
 * de la valeur determine le controle, et l'auteur d'un ecran n'a pas prise
 * dessus. Si l'un d'eux devient faux, c'est la grammaire qui a derive.
 */
describe('Grammaire des réglages — le contrôle se déduit de la nature', () => {
  it('toggle_When declared_Should render a switch', () => {
    render(<SettingRow setting={declare({ nature: { kind: 'toggle' }, value: true })} />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('choice_When up to four options_Should show them all rather than hide them behind an open', () => {
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'choice', options: options(4) }, value: 'v0' })}
      />,
    )
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('choice_When five options or more_Should switch to a dropdown', () => {
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'choice', options: options(5) }, value: 'v0' })}
      />,
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('multiChoice_When up to seven options_Should show checkboxes without a filter', () => {
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'multiChoice', options: options(7) }, value: ['v1'] })}
      />,
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('multiChoice_When more than seven options_Should offer a filter, since a long list is searched', async () => {
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'multiChoice', options: options(8) }, value: [] })}
      />,
    )

    const filter = screen.getByRole('textbox', { name: /filtrer/i })
    await userEvent.type(filter, 'Option 3')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })

  it('number_When given a unit_Should place it beside the control, never in the label', () => {
    render(
      <SettingRow
        setting={declare({
          label: 'Vidéo complète',
          nature: { kind: 'number', unit: 'jours', min: 0, max: 365 },
          value: 7,
        })}
      />,
    )

    expect(screen.getByText('Vidéo complète')).toBeInTheDocument()
    expect(screen.getByText('jours')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toHaveValue(7)
  })
})

describe('Grammaire des réglages — anatomie de la ligne', () => {
  it('help_When declared_Should stay behind an explicit trigger rather than take up room', async () => {
    render(<SettingRow setting={declare({ help: 'Explication longue.' })} />)

    expect(screen.queryByText('Explication longue.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /à quoi sert/i }))
    expect(await screen.findByText('Explication longue.')).toBeInTheDocument()
  })

  it('consequence_When declared_Should stay visible with no gesture, unlike help', () => {
    render(<SettingRow setting={declare({ consequence: 'Compter 1 à 3 Go par jour.' })} />)
    expect(screen.getByText('Compter 1 à 3 Go par jour.')).toBeInTheDocument()
  })

  it('provenance_When the value is inherited_Should offer nothing to undo', () => {
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'number', unit: 'jours' },
          value: 7,
          provenance: {
            following: true,
            fallbackLabel: '7 jours',
            revertLabel: 'Revenir à la valeur d’origine',
            onRevert: vi.fn(),
          },
        })}
      />,
    )

    expect(screen.queryByRole('button', { name: /revenir/i })).not.toBeInTheDocument()
    // Attenuee tant qu'elle est suivie : la provenance se lit sur l'aspect de la
    // valeur, pas sur une legende repetee sous chaque ligne.
    expect(screen.getByRole('spinbutton').className).toContain('text-muted-foreground')
  })

  it('provenance_When the value is the level’s own_Should name what the undo restores', async () => {
    const onRevert = vi.fn()
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'number', unit: 'jours' },
          value: 30,
          provenance: {
            following: false,
            fallbackLabel: '7 jours',
            revertLabel: 'Revenir à la valeur d’origine',
            onRevert,
          },
        })}
      />,
    )

    // Nomme la valeur retablie plutot que d'annoncer une remise a zero.
    const revert = screen.getAllByRole('button', {
      name: 'Revenir à la valeur d’origine : 7 jours',
    })
    expect(revert.length).toBeGreaterThan(0)

    await userEvent.click(revert[0])
    expect(onRevert).toHaveBeenCalled()
  })
})

describe('Grammaire des réglages — saisie numérique', () => {
  it('number_When typing_Should only commit on leaving the field', async () => {
    const onChange = vi.fn()
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'number', unit: 'jours' }, value: 0, onChange })}
      />,
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '30')
    // Sauver a chaque frappe enverrait « 3 » puis « 30 ».
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.tab()
    expect(onChange).toHaveBeenCalledExactlyOnceWith(30)
  })

  it('number_When the typed value exceeds the maximum_Should clamp it', async () => {
    const onChange = vi.fn()
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'number', unit: 'jours', min: 0, max: 365 },
          value: 7,
          onChange,
        })}
      />,
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.clear(input)
    await userEvent.type(input, '9999')
    await userEvent.tab()

    expect(onChange).toHaveBeenCalledExactlyOnceWith(365)
  })

  it('number_When the value is unchanged_Should not fire a save', async () => {
    const onChange = vi.fn()
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'number', unit: 'jours' }, value: 7, onChange })}
      />,
    )

    await userEvent.click(screen.getByRole('spinbutton'))
    await userEvent.tab()
    expect(onChange).not.toHaveBeenCalled()
  })
})
