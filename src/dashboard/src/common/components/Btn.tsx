import type { ButtonHTMLAttributes } from 'react'

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger-outline' | 'danger'
type BtnSize = 'sm' | 'md'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
}

export function Btn({
  variant = 'secondary',
  size = 'sm',
  loading,
  disabled,
  children,
  className,
  ...rest
}: BtnProps) {
  return (
    <button
      type="button"
      className={['btn', `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  )
}
