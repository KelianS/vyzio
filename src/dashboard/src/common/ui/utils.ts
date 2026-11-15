import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The theme's own radii and shadows, so `rounded-none` or `shadow-none` replaces them like any stock value.
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ['inset', 'card', 'panel'], shadow: ['elevated', 'header'] } },
})

/**
 * Merges Tailwind classes, letting the last one win on a given aspect
 * (`p-2 p-4` -> `p-4`). A shadcn/ui convention, expected by the primitives.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
