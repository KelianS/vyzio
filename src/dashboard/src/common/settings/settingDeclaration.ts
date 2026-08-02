/**
 * Declaration d'un reglage (ADR-43).
 *
 * Un reglage **se declare, il ne se dessine pas** : on decrit ce qu'il *est*,
 * et le rendu en deduit le controle, l'alignement, la provenance et le retour
 * arriere. L'auteur d'un ecran n'a pas prise sur l'apparence — non parce que
 * c'est interdit, mais parce que rien ici ne le lui propose.
 *
 * Etendre ce fichier revient a modifier la table des controles d'ADR-43 : c'est
 * une decision, et c'est exactement le frein recherche.
 */

export interface SettingOption<T extends string = string> {
  readonly value: T
  readonly label: string
}

/**
 * Nature de la valeur. Le controle employe s'en deduit seul, y compris le choix
 * entre deux formes d'un meme genre (cases visibles ou liste cherchable) : c'est
 * le **nombre d'options** qui tranche, jamais l'auteur de l'ecran. Deux reglages
 * de meme nature se presentent donc pareil partout.
 */
export type SettingNature =
  /** Booleen → interrupteur. L'etat est lisible sans lire le libelle. */
  | { readonly kind: 'toggle' }
  /** Choix exclusif → liste deroulante, quel qu'en soit le nombre d'options. */
  | { readonly kind: 'choice'; readonly options: readonly SettingOption[] }
  /** Choix multiple → cases visibles jusqu'a 7 options, liste cherchable au-dela. */
  | { readonly kind: 'multiChoice'; readonly options: readonly SettingOption[] }
  /** Nombre avec unite → champ numerique, unite en suffixe du controle. */
  | {
      readonly kind: 'number'
      readonly unit: string
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
  /** Texte libre. Rare : souvent un choix mal identifie. */
  | { readonly kind: 'text'; readonly placeholder?: string }
  /** Secret → champ masque, avec revelation : il faut pouvoir se relire. */
  | { readonly kind: 'secret'; readonly placeholder?: string }

/** Au-dela, une liste se cherche, elle ne se parcourt pas. */
export const VISIBLE_CHOICES_MAX = 7

/**
 * D'ou vient la valeur affichee, quand le reglage est surchargeable (ADR-39).
 * Fournie par la declaration, jamais recalculee dans le rendu.
 */
export interface SettingProvenance {
  /** `true` tant que la valeur est celle du niveau au-dessus. */
  readonly following: boolean
  /** Ce que le retour arriere retablit, deja formate pour etre lu. */
  readonly fallbackLabel: string
  /** Nomme la valeur retablie plutot que d'annoncer une remise a zero. */
  readonly revertLabel: string
  readonly onRevert: () => void
}

export interface SettingDeclaration<T = unknown> {
  readonly id: string
  readonly label: string
  readonly nature: SettingNature
  /**
   * Explication complete. Elle vit derriere un declencheur explicite : le nom du
   * reglage doit se suffire.
   */
  readonly help?: string
  /**
   * Ce que le reglage **coute** ou **implique** — espace disque, interruption,
   * irreversibilite. Reste visible sans geste supplementaire : cacher un cout
   * derriere un declencheur est un piege, pas de la sobriete (principe #4).
   */
  readonly consequence?: string
  readonly value: T
  readonly onChange: (value: T) => void
  readonly provenance?: SettingProvenance
  readonly disabled?: boolean
}
