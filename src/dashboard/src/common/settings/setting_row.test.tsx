import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingRow } from './setting_row'
import type { SettingDeclaration, SettingOption } from './setting_declaration'

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
 * These tests cover the **decision** of ADR-15, not the rendering: the nature of
 * the value determines the control, and the author of a screen has no hold on it.
 * If one of them turns false, it is the grammar that drifted.
 */
describe('SettingRow control', () => {
  it('SettingRow_ShouldRenderASwitch_WhenTheNatureIsToggle', () => {
    // Arrange & Act
    render(<SettingRow setting={declare({ nature: { kind: 'toggle' }, value: true })} />)

    // Assert
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it.each([2, 4, 9])(
    'SettingRow_ShouldRenderADropdown_WhenTheChoiceIsExclusive (%i options)',
    (count) => {
      // A segmented control with long labels overflows and breaks the shared control
      // column, which is precisely what makes a page scannable.
      // Arrange & Act
      render(
        <SettingRow
          setting={declare({ nature: { kind: 'choice', options: options(count) }, value: 'v0' })}
        />,
      )

      // Assert
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    },
  )

  it('SettingRow_ShouldSummariseTheStateOnOneLine_WhenAMultiChoiceIsAtRest', () => {
    // A setting reads at rest: a list of boxes shows the options, never the state -
    // and it eats the height of the page on the way.
    // Arrange & Act
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'multiChoice', options: options(7) },
          value: ['v1', 'v2', 'v3'],
        })}
      />,
    )

    // Assert
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /un réglage/i })).toHaveTextContent(
      'Option 1, Option 2 +1',
    )
  })

  it('SettingRow_ShouldListEveryOption_WhenTheUserOpensAMultiChoice', async () => {
    // Arrange
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'multiChoice', options: options(7) },
          value: ['v1', 'v2', 'v3'],
        })}
      />,
    )

    // Act
    await userEvent.click(screen.getByRole('combobox', { name: /un réglage/i }))

    // Assert
    expect(await screen.findAllByRole('checkbox')).toHaveLength(7)
  })

  it.each([
    { value: [] as string[], summary: 'Aucune sélection' },
    { value: options(3).map((option) => option.value), summary: 'Tout' },
  ])(
    'SettingRow_ShouldSaySoRatherThanCount_WhenAMultiChoiceHoldsNoneOrAll ($summary)',
    ({ value, summary }) => {
      // Arrange & Act
      render(
        <SettingRow
          setting={declare({ nature: { kind: 'multiChoice', options: options(3) }, value })}
        />,
      )

      // Assert
      expect(screen.getByRole('combobox')).toHaveTextContent(summary)
    },
  )

  it('SettingRow_ShouldSayWhatAnEmptyChoiceMeans_WhenTheSettingNamesIt', () => {
    // Arrange & Act
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'multiChoice', options: options(3), emptySummary: 'Toutes les caméras' },
          value: [],
        })}
      />,
    )

    // Assert
    expect(screen.getByRole('combobox')).toHaveTextContent('Toutes les caméras')
  })

  it('SettingRow_ShouldNameEveryItem_WhenAFullChoiceIsAListBecauseEmptyMeansEverything', () => {
    // Arrange & Act
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'multiChoice', options: options(2), emptySummary: 'Toutes les caméras' },
          value: ['v0', 'v1'],
        })}
      />,
    )

    // Assert
    expect(screen.getByRole('combobox')).toHaveTextContent('Option 0, Option 1')
  })

  it('SettingRow_ShouldOfferAFilterInThePanel_WhenAMultiChoiceHasMoreThanSevenOptions', async () => {
    // Arrange
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'multiChoice', options: options(8) }, value: [] })}
      />,
    )
    await userEvent.click(screen.getByRole('combobox'))
    const filter = await screen.findByRole('textbox', { name: /filtrer/i })

    // Act
    await userEvent.type(filter, 'Option 3')

    // Assert
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })

  it('SettingRow_ShouldPlaceTheUnitBesideTheControl_WhenANumberHasAUnit', () => {
    // Arrange & Act
    render(
      <SettingRow
        setting={declare({
          label: 'Vidéo complète',
          nature: { kind: 'number', unit: 'jours', min: 0, max: 365 },
          value: 7,
        })}
      />,
    )

    // Assert
    expect(screen.getByText('Vidéo complète')).toBeInTheDocument()
    expect(screen.getByText('jours')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toHaveValue(7)
  })
})

describe('SettingRow anatomy', () => {
  it.each([
    { kind: 'number', nature: { kind: 'number', unit: 'jours' }, value: 7 },
    { kind: 'toggle', nature: { kind: 'toggle' }, value: true },
  ] as const)(
    'SettingRow_ShouldPutTheControlBesideTheName_WhenTheControlIsShort ($kind)',
    ({ nature, value }) => {
      // Arrange & Act
      const { container } = render(<SettingRow setting={declare({ nature, value })} />)

      // Assert
      expect(container.firstElementChild?.className).toContain('grid-cols-[minmax(0,1fr)_auto]')
    },
  )

  it('SettingRow_ShouldPutTheControlUnderTheName_WhenTheControlIsLong', () => {
    // Arrange & Act
    const { container } = render(
      <SettingRow setting={declare({ nature: { kind: 'text' }, value: 'Salon' })} />,
    )

    // Assert
    expect(container.firstElementChild?.className).toContain('grid-cols-1')
  })

  it('SettingRow_ShouldKeepTheHelpBehindATrigger_WhenHelpIsDeclared', () => {
    // Arrange & Act
    render(<SettingRow setting={declare({ help: 'Explication longue.' })} />)

    // Assert
    expect(screen.queryByText('Explication longue.')).not.toBeInTheDocument()
  })

  it('SettingRow_ShouldRevealTheHelp_WhenTheUserOpensItsTrigger', async () => {
    // Arrange
    render(<SettingRow setting={declare({ help: 'Explication longue.' })} />)

    // Act
    await userEvent.click(screen.getByRole('button', { name: /à quoi sert/i }))

    // Assert
    expect(await screen.findByText('Explication longue.')).toBeInTheDocument()
  })

  it('SettingRow_ShouldShowTheConsequenceWithNoGesture_WhenOneIsDeclared', () => {
    // Arrange & Act
    render(<SettingRow setting={declare({ consequence: 'Compter 1 à 3 Go par jour.' })} />)

    // Assert
    expect(screen.getByText('Compter 1 à 3 Go par jour.')).toBeInTheDocument()
  })

  it('SettingRow_ShouldMarkTheValueWithAClosedLockAndOfferNoWayBack_WhenItIsInherited', () => {
    // Arrange & Act
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'number', unit: 'jours' },
          value: 7,
          inherits: { inherited: true, valueLabel: '7 jours', onRevert: vi.fn() },
        })}
      />,
    )

    // Assert
    expect(screen.getByRole('img', { name: 'Valeur de l’ensemble' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revenir/i })).not.toBeInTheDocument()
  })

  it('SettingRow_ShouldOfferAnOpenLockNamingWhatItRestores_WhenTheValueIsSetHere', () => {
    // Arrange & Act
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'number', unit: 'jours' },
          value: 30,
          inherits: { inherited: false, valueLabel: '7 jours', onRevert: vi.fn() },
        })}
      />,
    )

    // Assert
    expect(
      screen.getByRole('button', { name: 'Revenir à la valeur de l’ensemble (7 jours)' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Valeur de l’ensemble' })).not.toBeInTheDocument()
  })

  it('SettingRow_ShouldShowNoLock_WhenTheValueHasNoParent', () => {
    // Arrange & Act
    render(
      <SettingRow setting={declare({ nature: { kind: 'number', unit: 'jours' }, value: 7 })} />,
    )

    // Assert
    expect(screen.queryByRole('img', { name: 'Valeur de l’ensemble' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revenir/i })).not.toBeInTheDocument()
  })

  it('SettingRow_ShouldSayNoProvenanceUnderTheName_WhenTheValueIsInherited', () => {
    // Arrange & Act
    const { container } = render(
      <SettingRow
        setting={declare({
          nature: { kind: 'number', unit: 'jours' },
          value: 7,
          inherits: {
            inherited: true,
            valueLabel: '7 jours',
            onRevert: vi.fn(),
          },
        })}
      />,
    )

    // Assert
    // A list reads as names: the lock says it, never a nominal subtitle.
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('SettingRow_ShouldReadTheValueInFullInk_WhenItIsInherited', () => {
    // Arrange & Act
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'number', unit: 'jours' },
          value: 7,
          inherits: { inherited: true, valueLabel: '7 jours', onRevert: vi.fn() },
        })}
      />,
    )

    // Assert
    // A greyed value reads as a placeholder: the lock says the inheritance, never the ink.
    expect(screen.getByRole('spinbutton')).not.toHaveClass('text-muted-foreground')
  })

  it('SettingRow_ShouldRestoreTheInheritedValue_WhenTheUserTapsTheOpenLock', async () => {
    // Arrange
    const onRevert = vi.fn()
    render(
      <SettingRow
        setting={declare({
          nature: { kind: 'number', unit: 'jours' },
          value: 30,
          inherits: { inherited: false, valueLabel: '7 jours', onRevert },
        })}
      />,
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'Revenir à la valeur de l’ensemble (7 jours)' }),
    )

    // Assert
    expect(onRevert).toHaveBeenCalledOnce()
  })
})

describe('SettingRow number entry', () => {
  it('SettingRow_ShouldNotCommit_WhenTheUserIsStillTyping', async () => {
    // Arrange
    const onChange = vi.fn()
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'number', unit: 'jours' }, value: 0, onChange })}
      />,
    )

    // Act
    await userEvent.type(screen.getByRole('spinbutton'), '30')

    // Assert
    // Saving on every keystroke would fire "3" then "30".
    expect(onChange).not.toHaveBeenCalled()
  })

  it('SettingRow_ShouldCommitOnlyOnLeavingTheField_WhenTheUserTypesANumber', async () => {
    // Arrange
    const onChange = vi.fn()
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'number', unit: 'jours' }, value: 0, onChange })}
      />,
    )
    await userEvent.type(screen.getByRole('spinbutton'), '30')

    // Act
    await userEvent.tab()

    // Assert
    expect(onChange).toHaveBeenCalledExactlyOnceWith(30)
  })

  it('SettingRow_ShouldClampTheNumber_WhenTheTypedValueExceedsTheMaximum', async () => {
    // Arrange
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

    // Act
    await userEvent.tab()

    // Assert
    expect(onChange).toHaveBeenCalledExactlyOnceWith(365)
  })

  it('SettingRow_ShouldNotSave_WhenTheNumberIsUnchanged', async () => {
    // Arrange
    const onChange = vi.fn()
    render(
      <SettingRow
        setting={declare({ nature: { kind: 'number', unit: 'jours' }, value: 7, onChange })}
      />,
    )
    await userEvent.click(screen.getByRole('spinbutton'))

    // Act
    await userEvent.tab()

    // Assert
    expect(onChange).not.toHaveBeenCalled()
  })
})
