import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// The landing page's .btn as the shared button: solid primary with the soft-flat
// inner glow along the top edge; secondary is a light slate fill, never an
// outline (DESIGN.md). Focus is the global :focus-visible outline in
// app/globals.css, so nothing here sets outline-none.
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border-0 font-semibold tracking-normal whitespace-nowrap no-underline select-none",
    "transition-[background-color,color,transform] duration-160 ease-(--ease)",
    "active:translate-y-px disabled:cursor-not-allowed",
    // A disabled grey button is the same picture whether the request is in flight
    // or the connection has died. The bar is the difference. It waits .35s before
    // showing, so a fast reply never flashes it; under reduced motion it is
    // dropped rather than parked at one edge, since the label and the colour
    // already carry the state.
    "aria-busy:relative aria-busy:cursor-wait aria-busy:overflow-hidden aria-busy:after:absolute aria-busy:after:inset-x-0 aria-busy:after:bottom-0 aria-busy:after:h-0.5 aria-busy:after:-translate-x-full aria-busy:after:animate-pending aria-busy:after:bg-ink aria-busy:after:content-[''] motion-reduce:aria-busy:after:hidden",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-strong disabled:bg-fill disabled:text-outline",
        secondary:
          "bg-fill text-ink hover:bg-fill-hover aria-expanded:bg-fill-hover disabled:bg-fill disabled:text-outline",
        ghost:
          "text-ink hover:bg-surface-mid aria-expanded:bg-surface-mid disabled:text-outline",
        destructive:
          "bg-error/15 text-error hover:bg-error/25 disabled:bg-fill disabled:text-outline",
        link: "text-primary-ink underline-offset-4 hover:underline disabled:text-outline",
      },
      size: {
        default: "h-10 px-5 text-label leading-none",
        xs: "h-7 gap-1 px-2.5 text-fine leading-none [&_svg:not([class*='size-'])]:size-4",
        sm: "h-8 gap-1.5 px-3.5 text-fine leading-none [&_svg:not([class*='size-'])]:size-4",
        lg: "px-6 py-4 text-label leading-none",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12",
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
