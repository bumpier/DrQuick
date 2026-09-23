"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-label leading-none font-semibold text-ink select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-outline peer-disabled:cursor-not-allowed peer-disabled:text-outline",
        className
      )}
      {...props}
    />
  )
}

export { Label }
