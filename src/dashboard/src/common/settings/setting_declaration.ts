/**
 * Declaring a setting (ADR-43).
 *
 * A setting **is declared, it is not drawn**: one describes what it *is*, and the
 * rendering derives the control, the alignment, the provenance and the way back
 * from that. The author of a screen has no hold on the appearance - not because it
 * is forbidden, but because nothing here offers it to them.
 *
 * Extending this file amounts to changing the control table of ADR-43: that is a
 * decision, and that friction is exactly the point.
 */

export interface SettingOption<T extends string = string> {
  readonly value: T
  readonly label: string
}

/**
 * The nature of the value. The control follows from it alone, including the choice
 * between two shapes of one kind (visible boxes or a searchable list): the **number
 * of options** settles it, never the author of the screen. Two settings of the same
 * nature therefore look the same everywhere.
 */
export type SettingNature =
  /** Boolean -> a switch. The state reads without reading the label. */
  | { readonly kind: 'toggle' }
  /** Exclusive choice -> a dropdown, whatever the number of options. */
  | { readonly kind: 'choice'; readonly options: readonly SettingOption[] }
  /** Multiple choice -> a dropdown of checkboxes, summarised on one line at rest. */
  | { readonly kind: 'multiChoice'; readonly options: readonly SettingOption[] }
  /** Number -> a numeric field, the unit suffixing the control when there is one. */
  | {
      readonly kind: 'number'
      readonly unit?: string
      readonly min?: number
      readonly max?: number
    }
  /** Nombre borne a sens continu → curseur **et** valeur chiffree. */
  | {
      readonly kind: 'range'
      readonly unit: string
      readonly min: number
      readonly max: number
      readonly step?: number
    }
  /** Free text. Rare: often a choice that was misidentified. */
  | { readonly kind: 'text'; readonly placeholder?: string }
  /** Secret -> a masked field, with a reveal: one must be able to re-read it. */
  | { readonly kind: 'secret'; readonly placeholder?: string }

/** Beyond that, a filter appears in the panel: a long list is searched, not scanned. */
export const VISIBLE_CHOICES_MAX = 7

/**
 * Where the shown value comes from, when the setting can be overridden (ADR-39).
 * Supplied by the declaration, never recomputed while rendering.
 */
interface SettingProvenance {
  /** `true` for as long as the value is the one from the level above. */
  readonly following: boolean
  /** What going back restores, already formatted to be read. */
  readonly fallbackLabel: string
  /** Names the restored value rather than announcing a reset. */
  readonly revertLabel: string
  readonly onRevert: () => void
}

export interface SettingDeclaration<T = unknown> {
  readonly id: string
  readonly label: string
  readonly nature: SettingNature
  /**
   * The full explanation. It lives behind an explicit trigger: the name of the
   * setting must stand on its own.
   */
  readonly help?: string
  /**
   * What the setting **costs** or **implies** - disk space, interruption,
   * irreversibility. Stays visible without another gesture: hiding a cost behind
   * a trigger is a trap, not restraint (product principle #4).
   */
  readonly consequence?: string
  readonly value: T
  readonly onChange: (value: T) => void
  readonly provenance?: SettingProvenance
  readonly disabled?: boolean
}
