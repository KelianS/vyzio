import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind classes, letting the last one win on a given aspect
 * (`p-2 p-4` -> `p-4`). A shadcn/ui convention, expected by the primitives.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
