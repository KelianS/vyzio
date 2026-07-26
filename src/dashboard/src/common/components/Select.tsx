import type { SelectHTMLAttributes } from 'react'

type SelectSize = 'sm' | 'md'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: SelectSize
}

export function Select({ size = 'md', className, children, ...rest }: SelectProps) {
  return (
    <select
      className={['select', `select--${size}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </select>
  )
}
