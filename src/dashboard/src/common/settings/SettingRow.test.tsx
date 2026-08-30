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
 * These tests cover the **decision** of ADR-43, not the rendering: the nature of
 * the value determines the control, and the author of a screen has no hold on it.
 * If one of them turns false, it is the grammar that drifted.
 */
describe('Grammaire des réglages — le contrôle se déduit de la nature', () => {
  it('toggle_When declared_Should render a switch', () => {
    render(<SettingRow setting={declare({ nature: { kind: 'toggle' }, value: true })} />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it.each([2, 4, 9])(
    'choice_When exclusive with %i options_Should always be a dropdown',
    (count) => {
      // A segmented control with long labels overflows and breaks the shared control
      // column, which is precisely what makes a page scannable.
      render(
        <SettingRow
          setting={declare({ nature: { kind: 'choice', options: options(count) }, value: 'v0' })}
        />,
      )
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    },
  )

  it('multiChoice_When at rest_Should summarise the state on a single line', async () => {
    // A setting reads at rest: a list of boxes shows the options, never the state -
    // and it eats the height of the page on the way.
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'multiChoice', options: options(7) },
          value: ['v1', 'v2', 'v3'],
        })}
      />,
    )

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    const trigger = screen.getByRole('combobox', { name: /un réglage/i })
    expect(trigger).toHaveTextContent('Option 1, Option 2 +1')

    await userEvent.click(trigger)
    expect(await screen.findAllByRole('checkbox')).toHaveLength(7)
  })

  it.each([
    { value: [] as string[], summary: 'Aucune sélection' },
    { value: options(3).map((option) => option.value), summary: 'Tout' },
  ])('multiChoice_When $summary_Should say so rather than count', ({ value, summary }) => {
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'multiChoice', options: options(3) }, value })}
      />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent(summary)
  })

  it('multiChoice_When more than seven options_Should offer a filter inside the panel', async () => {
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'multiChoice', options: options(8) }, value: [] })}
      />,
    )

    await userEvent.click(screen.getByRole('combobox'))
    const filter = await screen.findByRole('textbox', { name: /filtrer/i })
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
    // Dimmed for as long as it follows: provenance reads from how the value looks,
    // not from a caption repeated under every row.
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

    // Names the restored value rather than announcing a reset.
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
    // Saving on every keystroke would fire "3" then "30".
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
