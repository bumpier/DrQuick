import * as React from "react"

import { cn } from "@/lib/utils"

// The same filled well as Input, grown to a paragraph.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border-2 border-transparent bg-fill px-[19px] py-[15px] text-base font-normal text-ink outline-none placeholder:text-ink-2",
        "transition-[background-color,border-color,box-shadow] duration-160 ease-(--ease)",
        "hover:bg-fill-hover focus:border-primary focus:bg-white focus:shadow-glow-primary",
        "aria-invalid:border-error aria-invalid:bg-white focus:aria-invalid:border-error focus:aria-invalid:shadow-glow-error",
        "disabled:cursor-not-allowed disabled:bg-fill disabled:text-outline",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
