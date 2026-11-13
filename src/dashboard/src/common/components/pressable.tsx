import type { ComponentProps } from 'react'
import { Slot } from 'radix-ui'

/** A control drawn without the button primitive, its one child the button: it presses like a button, by its slot. */
export function PressableControl(props: ComponentProps<typeof Slot.Root>) {
  return <Slot.Root data-slot="pressable-control" {...props} />
}

/** A surface that leads somewhere, its one child the link: it dims while pressed, by its slot. */
export function PressableSurface(props: ComponentProps<typeof Slot.Root>) {
  return <Slot.Root data-slot="pressable-surface" {...props} />
}
