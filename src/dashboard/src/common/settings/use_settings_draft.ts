import { useCallback, useMemo, useState } from 'react'

/** Page draft (ADR-41): edits are local until save, scoped to one page so it stays visible. */

/** A change, named in the user's words. */
export interface DraftChange {
  readonly key: string
  readonly label: string
}

export interface SettingsDraft<T> {
  /** What the screen renders: saved values overlaid with the draft. */
  readonly values: T
  /** Last saved value, for comparison. */
  readonly saved: T
  readonly dirty: boolean
  readonly changes: readonly DraftChange[]
  readonly set: <K extends keyof T>(key: K, value: T[K]) => void
  /** Drops one setting's edit, so it follows the saved value again, even once that is re-read. */
  readonly revert: (key: keyof T) => void
  /** Reverts the page to its last saved state. */
  readonly discard: () => void
  /** Clears the draft after a successful save. */
  readonly accept: () => void
}

export interface UseSettingsDraftOptions<T> {
  /** Saved values; a reload replaces them. */
  readonly saved: T
  /** Human label per setting, to say what changed. */
  readonly labels: Readonly<Record<keyof T, string>>
}

export function useSettingsDraft<T extends object>({
  saved,
  labels,
}: UseSettingsDraftOptions<T>): SettingsDraft<T> {
  const [edits, setEdits] = useState<Partial<T>>({})

  // Overlay rather than a copy-in-effect, which would drift once a value changes server-side.
  const values = useMemo(() => ({ ...saved, ...edits }) as T, [saved, edits])

  const changes = useMemo(() => {
    const touched = (Object.keys(edits) as (keyof T)[])
      // Back to the saved value is no longer a change.
      .filter((key) => !Object.is(edits[key], saved[key]))

    // One setting can span several keys (a level and whether it's pinned); count its label once.
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

  const revert = useCallback((key: keyof T) => {
    setEdits((previous) => {
      const next = { ...previous }
      delete next[key]
      return next
    })
  }, [])

  const discard = useCallback(() => setEdits({}), [])
  const accept = useCallback(() => setEdits({}), [])

  return {
    values,
    saved,
    dirty: changes.length > 0,
    changes,
    set,
    revert,
    discard,
    accept,
  }
}
