import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge only knows Tailwind's default scales. app/globals.css replaces
// the radius, shadow, breakpoint and type scales with DESIGN.md's named steps and
// adds named rhythms to spacing, so those names are registered here. Without
// this a className override such as `p-tile-lead-pad` on a Card would not
// displace the component's own padding, and the cascade, not the caller, would
// decide which one wins.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        "section", "section-open", "section-tight", "field-section",
        "hero-t", "hero-b", "hero-gap", "heading", "heading-tight",
        "covers-gap", "covers-gap-col", "recap-gap", "tile-lead-pad",
      ],
      radius: ["control", "tile", "pill"],
      text: ["lead", "title-lead", "question", "body", "label", "fine", "headline", "headline-sm"],
      shadow: ["card", "pop", "glow-primary", "glow-error", "btn-glow", "seg"],
      breakpoint: ["forms", "cols", "phone"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
