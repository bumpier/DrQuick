import * as React from "react"

import { cn } from "@/lib/utils"

// The filled well (DESIGN.md): a fill with no border at rest, turning white with
// the primary border and a soft glow on focus. A 2px transparent border is held
// at rest so going invalid changes only a colour — changing the width would shift
// the caret and the typed text by a pixel at the one moment the reader is staring
// at the field (plans/003-invalid-field-no-reflow.md). Invalid is the error red,
// not a heavier ring, so focus and invalid stay tellable apart.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 rounded-md border-2 border-transparent bg-fill px-[19px] py-[15px] text-base font-normal text-ink outline-none placeholder:text-ink-2",
        "transition-[background-color,border-color,box-shadow] duration-160 ease-(--ease)",
        "hover:bg-fill-hover focus:border-ink focus:bg-white focus:shadow-glow-primary",
        "aria-invalid:border-error aria-invalid:bg-white focus:aria-invalid:border-error focus:aria-invalid:shadow-glow-error",
        "disabled:cursor-not-allowed disabled:bg-fill disabled:text-outline",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-label file:font-semibold file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
