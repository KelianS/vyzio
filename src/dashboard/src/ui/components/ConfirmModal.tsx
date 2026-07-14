import { useEffect, useRef, useState } from 'react'
import { Btn } from './Btn'

interface ConfirmModalProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'warn' | 'danger' | 'default'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Annuler',
  tone = 'default',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [internalLoading, setInternalLoading] = useState(false)
  const isLoading = loading || internalLoading

  useEffect(() => {
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    focusable?.[0]?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!isLoading) onCancel()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel, isLoading])

  async function handleConfirm() {
    setInternalLoading(true)
    try {
      await onConfirm()
    } finally {
      setInternalLoading(false)
    }
  }

  const confirmVariant =
    tone === 'danger' ? 'danger' : tone === 'warn' ? 'danger-outline' : 'secondary'

  return (
    <div className="privacy-modal-backdrop" onClick={() => !isLoading && onCancel()}>
      <div
        ref={dialogRef}
        className="privacy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="privacy-modal-title">
          {title}
        </h2>
        <p className="privacy-modal-body">{body}</p>
        <div className="privacy-modal-actions">
          <Btn variant={confirmVariant} size="md" loading={isLoading} onClick={handleConfirm}>
            {confirmLabel}
          </Btn>
          <Btn variant="ghost" size="md" disabled={isLoading} onClick={onCancel}>
            {cancelLabel}
          </Btn>
        </div>
      </div>
    </div>
  )
}
