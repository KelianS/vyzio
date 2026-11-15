import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/common/ui/utils"

const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-all outline-none after:absolute focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border border-primary/35 bg-transparent text-primary hover:bg-primary/8",
        "destructive-outline":
          "border border-destructive/60 bg-transparent text-destructive hover:bg-destructive/8 focus-visible:ring-destructive/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-primary/18",
        ghost: "text-primary hover:bg-primary/8",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 after:inset-x-0 after:-inset-y-1 has-[>svg]:pr-6 has-[>svg]:pl-4",
        xs: "h-6 gap-1 px-2.5 text-xs after:inset-x-0 after:-inset-y-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-4 after:inset-x-0 after:-inset-y-2 has-[>svg]:pr-4 has-[>svg]:pl-3",
        lg: "h-12 px-8 after:inset-0 has-[>svg]:pr-8 has-[>svg]:pl-6",
        icon: "size-10 after:-inset-1",
        "icon-xs": "size-6 after:-inset-2.5 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 after:-inset-2",
        "icon-lg": "size-12 after:inset-0",
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
