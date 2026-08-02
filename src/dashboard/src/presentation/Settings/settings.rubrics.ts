/**
 * Les rubriques de reglages, declarees comme une donnee (ADR-40).
 *
 * Ranger un reglage nouveau consiste a l'ajouter dans une rubrique existante ou
 * a en creer une ici — la question « il va ou ? » a donc une reponse mecanique,
 * ce qui etait l'objet meme de la decision. Les rubriques sont organisees par
 * **domaine fonctionnel**, jamais par portee ni par ecran d'origine.
 */
export interface SettingsRubric {
  /** Segment de route sous `/settings`. */
  readonly slug: string
  readonly label: string
  /** Ce que la rubrique gouverne, en quelques mots. Une phrase complete ici
   *  concurrencerait le libelle au lieu de le preciser (ADR-43). */
  readonly summary: string
}

export const SETTINGS_RUBRICS: readonly SettingsRubric[] = [
  {
    slug: 'cameras',
    label: 'Caméras',
    summary: 'Ajout et réglages',
  },
  {
    slug: 'detection',
    label: 'Détection',
    summary: 'Ce qui est reconnu',
  },
  {
    slug: 'conservation',
    label: 'Conservation',
    summary: 'Durée des enregistrements',
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    summary: 'Canaux et horaires',
  },
  {
    slug: 'systeme',
    label: 'Système',
    summary: 'Stockage et ressources',
  },
]

export const SETTINGS_ROOT = '/settings'

export function rubricPath(slug: string) {
  return `${SETTINGS_ROOT}/${slug}`
}
