import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/common/ui/utils"

const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-body font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20",
        "destructive-outline":
          "bg-destructive/12 text-destructive hover:bg-destructive/18 focus-visible:ring-destructive/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-secondary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Every size reaches 44 px to the touch, drawn, never by an invisible margin (DESIGN SYSTEM § Interface tokens).
      size: {
        default: "h-11 px-5 has-[>svg]:pr-5 has-[>svg]:pl-4",
        xs: "h-11 gap-1 px-3 [&_svg:not([class*='size-'])]:size-4",
        sm: "h-11 gap-1.5 px-4 has-[>svg]:pr-4 has-[>svg]:pl-3",
        lg: "h-13 px-8 has-[>svg]:pr-8 has-[>svg]:pl-6",
        icon: "size-11",
        "icon-xs": "size-11 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-11",
        "icon-lg": "size-13",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
