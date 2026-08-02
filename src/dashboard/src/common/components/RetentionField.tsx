import { useState } from 'react'
import { RETENTION_EXPLANATION, RETENTION_LABEL, formatDays } from '../recording/retention'
import type { RetentionWindow } from '../recording/retention'

// What a camera-level field needs to say where its value comes from, and to give it back.
export interface RetentionInheritance {
  overridden: boolean
  installationDays: number
  onRevert: () => void
}

interface RetentionFieldProps {
  id: string
  window: RetentionWindow
  days: number
  maxDays: number
  onCommit: (days: number) => void
  // Absent at installation level, where there is nothing above to inherit from.
  inheritance?: RetentionInheritance
}

// One retention duration, always showing the value that actually applies — never a blank field or
// a greyed placeholder. Typing in it is what creates an override; the revert names the value it
// returns to rather than saying "reset" (ADR-39).
export function RetentionField({
  id,
  window,
  days,
  maxDays,
  onCommit,
  inheritance,
}: RetentionFieldProps) {
  // Held while the user types so a half-typed number is never saved, and reconciled by being
  // dropped on commit — the props are the source of truth the rest of the time.
  const [typed, setTyped] = useState<string | null>(null)

  function commit() {
    if (typed === null) return
    const parsed = Number.parseInt(typed, 10)
    setTyped(null)
    if (Number.isNaN(parsed)) return
    const clamped = Math.min(Math.max(parsed, 0), maxDays)
    if (clamped !== days) onCommit(clamped)
  }

  return (
    <div className="retention-row">
      <label className="retention-row-label" htmlFor={id}>
        {RETENTION_LABEL[window]}
      </label>
      <input
        id={id}
        className={`retention-row-input${inheritance?.overridden ? ' retention-row-input--overridden' : ''}`}
        type="number"
        min={0}
        max={maxDays}
        value={typed ?? String(days)}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <span className="retention-row-unit">jours</span>

      {inheritance &&
        (inheritance.overridden ? (
          <p className="retention-row-origin retention-row-origin--overridden">
            <span className="retention-origin-dot" aria-hidden="true" />
            Propre à cette caméra
            <button type="button" className="retention-revert" onClick={inheritance.onRevert}>
              ↺ revenir à {formatDays(inheritance.installationDays)}
            </button>
          </p>
        ) : (
          <p className="retention-row-origin">Suit les réglages généraux</p>
        ))}

      <p className="detection-field-hint">{RETENTION_EXPLANATION[window]}</p>
    </div>
  )
}
