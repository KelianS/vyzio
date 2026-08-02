import { useCallback, useMemo, useState } from 'react'

/**
 * Brouillon de page (ADR-41).
 *
 * Modifier des valeurs **n'a aucun effet** : tout reste local jusqu'a
 * l'enregistrement. Le brouillon reprend au passage le role que la separation
 * « enregistrer puis appliquer » jouait en douce — **grouper plusieurs
 * changements en une seule mise en service** — mais il le rend visible au lieu
 * d'en faire un effet de bord.
 *
 * L'unite est la **page** : un brouillon qui traverse la navigation serait
 * invisible depuis l'endroit ou il agit, impossible a suivre et facile a
 * perdre.
 */

/** Ce qui a change, dit avec les mots de l'utilisateur. */
export interface DraftChange {
  readonly key: string
  readonly label: string
}

export interface SettingsDraft<T> {
  /** Ce qui s'applique a l'ecran : la base, recouverte du brouillon. */
  readonly values: T
  /** La derniere valeur enregistree, pour comparer. */
  readonly saved: T
  readonly dirty: boolean
  readonly changes: readonly DraftChange[]
  readonly set: <K extends keyof T>(key: K, value: T[K]) => void
  /** Rend la page a son dernier etat enregistre. */
  readonly discard: () => void
  /** Vide le brouillon apres un enregistrement reussi. */
  readonly accept: () => void
}

export interface UseSettingsDraftOptions<T> {
  /** Valeurs enregistrees. Un rechargement les remplace. */
  readonly saved: T
  /** Nom lisible de chaque reglage, pour dire **ce qui** a change. */
  readonly labels: Readonly<Record<keyof T, string>>
}

export function useSettingsDraft<T extends object>({
  saved,
  labels,
}: UseSettingsDraftOptions<T>): SettingsDraft<T> {
  const [edits, setEdits] = useState<Partial<T>>({})

  // Recouvrement plutot qu'une copie posee dans un effet : une copie se
  // desynchroniserait du serveur des qu'une valeur revient d'ailleurs.
  const values = useMemo(() => ({ ...saved, ...edits }) as T, [saved, edits])

  const changes = useMemo(() => {
    const touched = (Object.keys(edits) as (keyof T)[])
      // Revenir a la valeur enregistree annule la modification : ce n'est plus
      // un changement, et le brouillon ne doit pas pretendre le contraire.
      .filter((key) => !Object.is(edits[key], saved[key]))

    // Un meme reglage peut s'ecrire sur plusieurs cles — un niveau et le fait
    // qu'il soit fixe, par exemple. L'utilisateur, lui, n'en a change qu'un :
    // compter deux fois le meme libelle lui ferait douter de ce qu'il a fait.
    const seen = new Set<string>()
    return touched.reduce<DraftChange[]>((accumulated, key) => {
      const label = labels[key]
      if (seen.has(label)) return accumulated
      seen.add(label)
      accumulated.push({ key: String(key), label })
      return accumulated
    }, [])
  }, [edits, saved, labels])

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setEdits((previous) => ({ ...previous, [key]: value }))
  }, [])

  const discard = useCallback(() => setEdits({}), [])
  const accept = useCallback(() => setEdits({}), [])

  return {
    values,
    saved,
    dirty: changes.length > 0,
    changes,
    set,
    discard,
    accept,
  }
}
