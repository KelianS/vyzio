import { useState, type MouseEvent } from 'react'
import type { VariantProps } from 'class-variance-authority'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import type { buttonVariants } from '../ui/button'
import { cn } from '../ui/utils'

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>

interface ConfirmModalProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'warn' | 'danger' | 'default' | 'confirm'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

const CONFIRM_VARIANT: Record<Required<ConfirmModalProps>['tone'], ButtonVariant> = {
  danger: 'destructive',
  warn: 'outline',
  confirm: 'default',
  default: 'secondary',
}

/** Confirmation dialog on the shadcn AlertDialog primitive (ADR-42): focus trap and Escape come from Radix. */
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
  const [internalLoading, setInternalLoading] = useState(false)
  const isLoading = loading || internalLoading

  async function handleConfirm(event: MouseEvent) {
    // Stays mounted for the async action; the caller unmounts once it settles.
    event.preventDefault()
    setInternalLoading(true)
    try {
      await onConfirm()
    } finally {
      setInternalLoading(false)
    }
  }

  function handleCancel(event: MouseEvent) {
    event.preventDefault()
    onCancel()
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !isLoading && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} onClick={handleCancel}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={CONFIRM_VARIANT[tone]}
            className={cn(
              tone === 'warn' && 'border-destructive text-destructive hover:bg-destructive/10',
            )}
            disabled={isLoading}
            onClick={handleConfirm}
          >
            {isLoading ? '…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
