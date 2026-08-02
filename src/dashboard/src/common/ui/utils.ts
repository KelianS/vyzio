import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Fusionne des classes Tailwind en laissant la derniere gagner sur un meme
 * aspect (`p-2 p-4` → `p-4`). Convention shadcn/ui, attendue par les primitives.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
