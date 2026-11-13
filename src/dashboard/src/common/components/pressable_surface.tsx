import type { ComponentProps } from 'react'
import { Slot } from 'radix-ui'

/** A surface that leads somewhere, its one child the link: it dims while pressed, by its slot. */
export function PressableSurface(props: ComponentProps<typeof Slot.Root>) {
  return <Slot.Root data-slot="pressable-surface" {...props} />
}
