import { useState } from 'react'
import { RETENTION_EXPLANATION, RETENTION_LABEL, formatDays } from '../recording/retention'
import type { RetentionWindow } from '../recording/retention'

// The value this field falls back to, one level up: the installation values for a camera, the
// shipped values for the installation itself. Same affordance at both levels.
export interface RetentionFallback {
  // Whether the field currently sits on its fallback — nothing to revert, nothing to signal.
  atFallback: boolean
  days: number
  // Spelled out rather than derived from one another: French prepositions contract differently
  // ("aux réglages généraux", "à la valeur d’origine") and a rule guessing that would be brittle.
  followingLabel: string
  revertLabel: string
  onRevert: () => void
}

interface RetentionFieldProps {
  id: string
  window: RetentionWindow
  days: number
  maxDays: number
  onCommit: (days: number) => void
  fallback?: RetentionFallback
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
  fallback,
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

  // Provenance is carried by the look of the value rather than by a caption: muted while it sits on
  // the fallback, plain once it has been set here, and the revert only exists where there is
  // something to revert. A caption on every row would repeat itself without teaching anything.
  const muted = fallback?.atFallback === true
  const revertLabel = fallback && `${fallback.revertLabel} : ${formatDays(fallback.days)}`

  return (
    <div className="retention-row">
      <label className="retention-row-label" htmlFor={id}>
        {RETENTION_LABEL[window]}
      </label>
      <input
        id={id}
        className={`retention-row-input${muted ? ' retention-row-input--inherited' : ''}`}
        type="number"
        min={0}
        max={maxDays}
        value={typed ?? String(days)}
        // Hover and screen readers still get the words; the layout does not have to carry them.
        title={muted ? fallback.followingLabel : undefined}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <span className={`retention-row-unit${muted ? ' retention-row-unit--inherited' : ''}`}>
        jours
      </span>

      {fallback && !fallback.atFallback && (
        <button
          type="button"
          className="retention-revert"
          onClick={fallback.onRevert}
          title={revertLabel}
          aria-label={revertLabel}
        >
          ↺
        </button>
      )}

      <p className="detection-field-hint">{RETENTION_EXPLANATION[window]}</p>
    </div>
  )
}
