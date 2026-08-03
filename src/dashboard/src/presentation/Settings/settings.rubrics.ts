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

/**
 * Une page est nommee **une seule fois**. Par defaut c'est la coquille des
 * reglages qui s'en charge, a partir de la rubrique ouverte.
 *
 * Certaines routes nomment autre chose que leur rubrique — la fiche d'une camera
 * porte le nom de la camera, l'ajout porte le nom de la tache. Elles le
 * declarent ici, sur la route : c'est la seule information que la coquille ne
 * peut pas deduire, et la mettre dans l'arbre de routes evite d'y repondre par
 * une liste de chemins particuliers.
 */
export interface SettingsRouteHandle {
  /** La route affiche son propre titre : la rubrique n'en ajoute pas. */
  readonly ownHeader?: boolean
  /** La route affiche son propre retour : la rubrique n'en ajoute pas. */
  readonly ownBackLink?: boolean
}

/** Ecran repris qui se nomme **et** ramene d'ou il vient. */
export const OWN_HEADER: SettingsRouteHandle = { ownHeader: true, ownBackLink: true }

/**
 * Ecran pas encore repris : il porte deja un titre, mais aucun retour. Lui
 * retirer celui de la rubrique le rendrait sans issue sur petit ecran, ou le
 * menu est masque.
 */
export const OWN_HEADER_ONLY: SettingsRouteHandle = { ownHeader: true }

function handlesOf(matches: readonly { readonly handle?: unknown }[]) {
  return matches.map((match) => match.handle as SettingsRouteHandle | undefined)
}

export function declaresOwnHeader(matches: readonly { readonly handle?: unknown }[]): boolean {
  return handlesOf(matches).some((handle) => handle?.ownHeader)
}

export function declaresOwnBackLink(matches: readonly { readonly handle?: unknown }[]): boolean {
  return handlesOf(matches).some((handle) => handle?.ownBackLink)
}
