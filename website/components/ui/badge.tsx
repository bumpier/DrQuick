import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Status chips (DESIGN.md): a 15% fill of the semantic colour with 700-weight
// text in the same colour; a full pill so they never read as buttons. There is
// no outline variant.
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-pill px-2 text-xs font-bold whitespace-nowrap transition-[background-color,color] duration-160 ease-(--ease) has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary [a]:hover:bg-primary/25",
        secondary: "bg-fill text-ink-2 [a]:hover:bg-fill-hover",
        success: "bg-success/15 text-success",
        destructive: "bg-error/15 text-error [a]:hover:bg-error/25",
        ghost: "text-ink-2 hover:bg-surface-mid hover:text-ink",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
