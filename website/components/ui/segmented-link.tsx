import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// The Patients / GPs switch: real links carrying aria-current, resolved before
// paint by the inline head script in app/layout.tsx. It is never Tabs or
// ToggleGroup (CLAUDE.md) — without JavaScript the links still navigate. The
// current link is the lime pill, carrying forest text. The one
// interactive pill on the landing page; also the link-based role switch for any
// dashboard.
const segmentedLinkGroupVariants = cva("flex gap-0.5 rounded-pill bg-fill", {
  variants: {
    size: {
      default: "p-[3px] max-phone:p-0.5",
      sm: "p-0.5",
    },
  },
  defaultVariants: { size: "default" },
})

const segmentedLinkVariants = cva(
  "inline-flex items-center justify-center rounded-pill font-semibold tracking-[-.01em] whitespace-nowrap text-ink-2 no-underline transition-[background-color,color,box-shadow] duration-160 ease-(--ease) hover:text-ink aria-[current]:bg-primary aria-[current]:text-ink",
  {
    variants: {
      size: {
        default: "px-4 py-[9px] text-label max-phone:px-[11px] max-phone:py-2 max-phone:text-fine",
        sm: "px-[11px] py-2 text-fine",
      },
    },
    defaultVariants: { size: "default" },
  }
)

const SegmentedLinkGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & VariantProps<typeof segmentedLinkGroupVariants>
>(function SegmentedLinkGroup({ className, size = "default", ...props }, ref) {
  return (
    <div
      ref={ref}
      role="group"
      data-slot="segmented-link-group"
      data-size={size}
      className={cn(segmentedLinkGroupVariants({ size }), className)}
      {...props}
    />
  )
})

const SegmentedLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> &
    VariantProps<typeof segmentedLinkVariants> & {
      // The selected link. Rendered as aria-current="page"; the landing page's
      // behaviour script moves the attribute between links at runtime.
      current?: boolean
    }
>(function SegmentedLink({ className, size = "default", current, ...props }, ref) {
  return (
    <a
      ref={ref}
      data-slot="segmented-link"
      aria-current={current ? "page" : undefined}
      className={cn(segmentedLinkVariants({ size }), className)}
      {...props}
    />
  )
})

export { SegmentedLinkGroup, SegmentedLink, segmentedLinkGroupVariants, segmentedLinkVariants }
