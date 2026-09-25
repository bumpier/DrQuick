import * as React from "react"

import { cn } from "@/lib/utils"

// The same field as Input, grown to a paragraph.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border-2 border-rule bg-white px-[19px] py-[15px] text-base font-normal text-ink outline-none placeholder:text-ink-2",
        "transition-[background-color,border-color,box-shadow] duration-160 ease-(--ease)",
        "hover:border-outline focus:border-ink focus:shadow-glow-primary",
        "aria-invalid:border-error aria-invalid:bg-white focus:aria-invalid:border-error focus:aria-invalid:shadow-glow-error",
        "disabled:cursor-not-allowed disabled:border-fill disabled:bg-fill disabled:text-outline",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
