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
  /** Ce que la rubrique gouverne, en une ligne, pour la liste de premier niveau. */
  readonly summary: string
}

export const SETTINGS_RUBRICS: readonly SettingsRubric[] = [
  {
    slug: 'cameras',
    label: 'Caméras',
    summary: 'Ajouter une caméra, et régler chacune séparément.',
  },
  {
    slug: 'detection',
    label: 'Détection',
    summary: 'Ce que Vyzio cherche à reconnaître, et les personnes qu’il sait nommer.',
  },
  {
    slug: 'conservation',
    label: 'Conservation',
    summary: 'Combien de temps les enregistrements sont gardés, pour toutes les caméras.',
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    summary: 'Comment et quand vous êtes prévenu.',
  },
  {
    slug: 'systeme',
    label: 'Système',
    summary: 'Stockage, ressources, et les réglages rarement nécessaires.',
  },
]

export const SETTINGS_ROOT = '/settings'

export function rubricPath(slug: string) {
  return `${SETTINGS_ROOT}/${slug}`
}
