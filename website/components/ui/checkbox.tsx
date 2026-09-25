"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// The clinical-skills list: a doctor ticks what they will see, so the control is
// the radio item's twin — a 20px square on white, filled primary when chosen —
// and the after: pseudo-element widens the target past the 20px box so the whole
// row is tappable. Focus is the global :focus-visible outline, never a ring.
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox peer relative flex aspect-square size-5 shrink-0 items-center justify-center rounded-sm border-2 border-outline bg-white transition-[border-color,background-color] duration-160 ease-(--ease) after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:border-fill disabled:bg-fill aria-invalid:border-error data-checked:border-primary-ink data-checked:bg-primary-ink data-checked:text-white",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
      >
        <CheckIcon className="size-3.5" strokeWidth={2} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
